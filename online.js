(function () {
"use strict";
var uniqueUserId = 0;
var uniqueVillageId = 0;
var lobby;
var villages = {};
var villageList = [];

function User (opts) {
  this.init(opts);
}

User.prototype.init = function (opts) {
  this.id = uniqueUserId++;
  this.name = opts.name || 'user ' + this.id;
  var socket = this.socket = opts.socket;
  lobby.join(this);
  var user = this;
  socket.emit('welcome', { id: this.id, name: this.name });
  socket.on('disconnect', function () {
    user.currentRoom.leave(user);
  });

  socket.on('say', function (data) {
    if ( user.currentRoom.canSpeak(user) ) {
      user.currentRoom.broadcast('said', {at: user.currentRoom.id || 0, by: user.name, string: data.string });
    }
  });

  socket.on('untilTimeout', function () {
    var val = -1;
    var timeoutStatus = {
      discussing: 1,
      voting: 1,
      postmortem: 1
    };
    if ( user.currentRoom === lobby || !timeoutStatus[user.currentRoom.status] ) {
      user.socket.emit('untilTimeout', -1);
    }
    else {
      user.socket.emit( 'untilTimeout', user.currentRoom.untilTimeout() );
    }

  });

  socket.on('listVillage', function (data) {
    if ( user.currentRoom === lobby ) {
      user.socket.emit('listVillage', villageList);
    }
  });

  socket.on('createVillage', function (data) {
    if ( user.currentRoom === lobby ) {
      lobby.createVillage(user);
    }
  });

  socket.on('joinVillage', function (vid) {
    if ( user.currentRoom === lobby ) {
      lobby.joinToVillage(user,parseInt(vid));
    }
  });

  socket.on('buildVillage', function (opts) {
    if ( user.currentRoom === lobby || user.currentRoom.owner !== user || user.currentRoom.status !== 'prebuild' ) {
      return;
    }
    user.currentRoom.build(opts);
  });

  socket.on('rebuildVillage', function (opts) {
    if ( user.currentRoom === lobby || user.currentRoom.masterId !== user || user.currentRoom.status !== 'intro' ) {
      return;
    }
    user.currentRoom.startIntro(opts);
  });


  socket.on('leaveVillage', function () {
    if ( user.currentRoom === lobby || user.currentRoom.status !== 'waiting' ) {
      return;
    }
    user.currentRoom.leave(user);
  });

  socket.on('start', function () {
    if ( user.currentRoom === lobby || user.currentRoom.owner !== user || user.currentRoom.status !== 'waiting' ) {
      return;
    }
    user.currentRoom.startIntro();
  });

  socket.on('commitWordpair', function (data) {
    if ( user.currentRoom === lobby || user.currentRoom.masterId !== user.id ) {
      return;
    }
    user.currentRoom.setWordpair(data);
  });

  socket.on('vote', function (data) {
    if ( user.currentRoom === lobby || user.currentRoom.masterId === user.id ) {
      return;
    }
    user.currentRoom.vote(user,parseInt(data));
  });

  socket.on('judgeRevenge', function (result) {
    if ( user.currentRoom === lobby || user.currentRoom.masterId !== user.id ) {
      return;
    }
    user.currentRoom.judgeRevenge(result);
  });

  socket.on('setName', function (name) {
    user.name = name;
    socket.emit('welcome', { id: user.id, name: user.name });
  });
};

User.prototype.send = function (msg) {
  this.socket.send(msg);
};

function Room (opts) {
  this.init(opts);
}

Room.prototype.init = function (opts) {
  this.member = {};
  this.id = uniqueVillageId++;
};

Room.prototype.join = function (user) {
  this.member[user.id] = user;
  user.currentRoom = this;
  user.socket.emit('entered', this.describe());
};

Room.prototype.leave = function (user) {
  delete this.member[user.id];
};

Room.prototype.broadcast = function (type,msg) {
  for ( var uid in this.member ) {
    this.member[uid].socket.emit(type,msg);
  }
};

Room.prototype.canSpeak = function () {
  return true;
};

function Lobby (opts) {
  this.init(opts);
}

Lobby.prototype = Object.create(Room.prototype);

Lobby.prototype.sendVillageList = function () {

};

Lobby.prototype.describe = function () {
  return { type: 'lobby' };
};

Lobby.prototype.createVillage = function (owner) {
  if ( owner.currentRoom !== this ) return;
  var village = new Village(owner);
  villages[village.id] = village;
  village.join(owner);
  this.leave(owner);
}

Lobby.prototype.joinToVillage = function (user,vid) {
  if ( user.currentRoom !== this ) return;
  var village = villages[parseInt(vid)];
  if ( !village ) return;
  village.join(user);
  this.leave(user);
}

function Village (owner,opts) {
  this.init(opts);
  this.owner = owner;
  this.watchers = {};
  // status: prebuild -> waiting -> intro -> discussing -> voting -> revenge -> postmortem -> waiting...
  this.name = 'village ' + this.id;
  this.numWolves = 1;
  this.setStatus('prebuild');
  this.voteMap = {};
}

Village.prototype = Object.create(Room.prototype);

Village.prototype.join = function (user) {
  Room.prototype.join.call(this, user);
  if ( this.status !== 'waiting' ) {
    this.watchers[user.id] = 1;
  }
  this.sendMemberList();
  user.socket.emit('progress', {status: this.status});
}

Village.prototype.leave = function (user,crashVillage) {
  Room.prototype.leave.call(this, user);
  lobby.join(user);
  if ( crashVillage ) return;
  if ( this.owner === user ) {
    for ( var i in this.member ) {
      this.leave(this.member[i], true);
    }
  }
  this.sendMemberList();
  if ( this.count() === 0 ) {
    delete villages[this.id];
    buildVillageList();
  }
};

Village.prototype.describe = function () {
  return {
    id: this.id,
    type: 'village',
    name: this.name || 'village ' + this.id,
  };
};

Village.prototype.count = function () {
  var members  = 0;
  for ( var id in this.member ) {
    members++;
  }
  return members;
};

Village.prototype.canSpeak = function (user) {
  return this.watchers[user.id] ? false : true;
};

Village.prototype.setStatus = function (status) {
  this.status = status;
  var data = { status: status };
  for ( var id in this.member ) {
    if ( status === 'revenge' || status === 'postmortem' ) {
      data.yourrole = this.roleMap[id];
      if ( this.banishedId > -1 ) {
        data.banished = this.member[this.banishedId].name;
      }
    }
    this.member[id].socket.emit('progress', data);
  }
};

Village.prototype.untilTimeout = function () {
  var now = (new Date()).getTime();
  return this.nextTimeout - now;
};

Village.prototype.sendMemberList = function () {
  var list = [];
  for ( var id in this.member ) {
    var m = this.member[id];
    var data = {
      id: id,
      name: m.name
    };
    if ( this.owner === m ) {
      data.isOwner = true;
    }
    if ( this.status !== 'prebuild' && this.status !== 'waiting' && parseInt(id) === parseInt(this.masterId) ) {
      data.isMaster = true;
    }
    if ( this.watchers[id] ) {
      data.isWatcher = true;
    }
    if ( this.status === 'revenge' || this.status === 'postmortem' ) {
      data.role = this.roleMap[id];
    }
    list.push(data);
  }
  this.broadcast('listMember', list);
}

Village.prototype.build = function (setting) {
  this.name = setting.name;
  this.discussionSeconds = parseFloat(setting.discussionMinutes) * 60;
  this.setStatus('waiting');
  this.watchers = {};
  buildVillageList();
  lobby.broadcast('listVillage', villageList);
}

Village.prototype.startIntro = function () {
  this.roll();
  this.setStatus('intro');
  this.sendMemberList();
}

Village.prototype.setWordpair = function (data) {
  this.ww = data.ww;
  this.vw = data.vw;
  this.setStatus('discussing');
  var village = this;
  this.tellWordpair();
  var now = (new Date()).getTime();
  this.nextTimeout = now + this.discussionSeconds * 1000;
  this.timer = setTimeout( function () {
    village.finishDiscussion();
  }, village.discussionSeconds * 1000);
};

Village.prototype.tellWordpair = function () {
  for ( var id in this.member ) {
    var member = this.member[id];
    var role = this.roleMap[id];
    if ( role === 'wolf' ) {
      member.socket.emit('tellword', this.ww);
    }
    else if ( role === 'villager' ) {
      member.socket.emit('tellword', this.vw);
    }
  };
};

Village.prototype.finishDiscussion = function () {
  this.setStatus('voting');
  clearTimeout(this.timer);
  var village = this;
  var now = (new Date()).getTime();
  this.nextTimeout = now + 10000;
  this.timer = setTimeout( function () {
    village.finishVoting();
  }, 10000);
};

Village.prototype.finishVoting = function () {
  var counts = {};
  for ( var from in this.voteMap ) {
    var to = this.voteMap[from];
    if ( ! counts[to] ) {
      counts[to] = 0;
    }
    counts[to]++;
  }
  var max = 0;
  var topCandidate;
  var same = 0;
  for ( var id in counts ) {
    if ( max < counts[id] ) {
      topCandidate = id;
      same = 0;
      max = counts[id];
    }
    else if ( max === counts[id] ) {
      same++;
    }
  }

  if ( same > 0 ) {
    this.showResult('noBanish');
  }
  else {
    this.banishedId = topCandidate;
    if ( this.roleMap[topCandidate] === 'villager' ) {
      this.showResult('villagerBanished');
    }
    else {
      this.setStatus('revenge');
    }
  }
};

Village.prototype.judgeRevenge = function (result) {
  if ( result === 'success' ) {
    this.showResult('wolfRevenge');
  }
  else {
    this.showResult('wolfBanished');
  }
};

Village.prototype.roll = function () {
  // bring role (master/villager/wolf) to villagers randomly
  var roles = [];
  var villagers = this.count() - ( 1 + this.numWolves ); // GM and wolves
  for ( var i=0; i<villagers; i++ ) {
    roles.push('villager');
  }
  for ( var i=0; i<this.numWolves; i++ ) {
    roles.push('wolf');
  }
  roles.push('master');
  roles = shuffle(roles);
  var roleMap = this.roleMap = {};
  this.masterId = -1;
  for ( var id in this.member ) {
    id = parseInt(id);
    var role = roles.shift();
    roleMap[id] = role;
    if ( role === 'master' ) {
      this.masterId = id;
    }
  }
  if ( this.masterId === -1 ) {
    throw 'no master';
  }
};

Village.prototype.vote = function (user,to) {
  if ( this.status !== 'voting' ) return;
  this.voteMap[user.id] = parseInt(to);
  this.broadcast('voted', { from: user.id, to: to });
};

Village.prototype.showResult = function (result) {
  var playerMap = {};
  for ( var id in this.member ) {
    playerMap[id] = this.member[id].name;
  }
  for ( var id in this.member ) {
    var data = {
      result: result,
      yourrole: this.roleMap[id],
      roleMap: this.roleMap,
      voteMap: this.voteMap,
      ww: this.ww,
      vw: this.vw,
      playerMap: playerMap
    };

    var user = this.member[id];
    if ( result === 'wolfBanished' ) {
      data.winby === 'villager';
      if ( this.roleMap[id] === 'wolf' ) {
        data.yourresult = 'lose';
      }
      else if ( this.roleMap[id] === 'villager' ) {
        data.yourresult = 'win';
      }
    }
    else {
      data.winby === 'wolf';
      if ( this.roleMap[id] === 'wolf' ) {
        data.yourresult = 'win';
      }
      else if ( this.roleMap[id] === 'villager' ) {
        data.yourresult = 'lose';
      }
    }
    user.socket.emit('result', data);
  }

  this.setStatus('postmortem');
  clearTimeout(this.timer);
  var village = this;
  var now = (new Date()).getTime();
  this.nextTimeout = now + 10000;
  this.timer = setTimeout(function () {
    village.setStatus('postwordpair');
  }, 10000);
};

function shuffle (array) {
  var len = array.length;
  for ( var i=0;i<len-1;i++ ) {
    var x = parseInt( Math.random() * (len - i) );
    var tmp = array[i];
    array[i] = array[i + x];
    array[i + x] = tmp;
  }
  return array;
}

lobby = new Lobby({});

function buildVillageList() {
  villageList = [];
  for ( var vid in villages ) {
    if ( villages[vid].status === 'prebuild' ) continue;
    villageList.push({
      id: vid,
      members: villages[vid].member.length,
      name: villages[vid].name || 'village ' + vid,
      status: villages[vid].status
    });
  }
}

module.exports = {
  Lobby: Lobby,
  User: User
};

})();
