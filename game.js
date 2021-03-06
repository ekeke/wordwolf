(function () {

function Player (name,id,point) {
  this.name = name;
  this.id = id;
  this.point = point;
}

Player.prototype.applyPoint = function (diff) {
  this.point += diff;
};

function Players () {
  this.member = {};
}

Players.prototype.add = function (name,id) {
  if ( this.member[id] ) return;
  this.member[id] = new Player(name,id,0);
};

Players.prototype.remove = function (id) {
  delete this.member['' + id];
}

Players.prototype.save = function () {
  localStorage.players = JSON.stringify(this.member);
};

Players.prototype.count = function () {
  var i=0;
  for ( var id in this.member ) {
    i++;
  }
  return i;
};

Players.prototype.maxId = function () {
  var max=0;
  for ( var id in this.member ) {
    if ( max < parseInt(id) ) { max = parseInt(id); }
  }
  return max;
};

Players.prototype.load = function () {
  this.member = {};
  var json = localStorage.players
    || '{"0":{"name":"プレイヤー1","point":0},"1":{"name":"プレイヤー2","point":0},"2":{"name":"プレイヤー3","point":0},"3":{"name":"プレイヤー4","point":0}}';
  var saved = JSON.parse(json);
  for ( var id in saved ) {
    this.member[id] = new Player(saved[id].name, id, saved[id].point);
  }
}

function Village (players, numWolves, villagerWord, wolfWord, gameMasterId) {
  var numPlayers = players.count();
  this.villagerWord = villagerWord;
  this.wolfWord = wolfWord;
  this.players = players;
  if ( gameMasterId ) {
    numPlayers--;
  }
  var roles = [];
  this.numWolves = numWolves;
  this.numVillagers = numPlayers - numWolves;
  for ( var i=0;i<this.numVillagers;i++ ) {
    roles.push('villager');
  }
  for ( var i=0;i<numWolves;i++ ) {
    roles.push('wolf');
  }
  shuffle(roles);
  this.member = [];
  this.votes = {};
  this.voteMap = {};
  for ( var id in players.member ) {
    if ( id === gameMasterId ) {
      players.member[id].role = 'master';
      continue;
    }
    this.member.push(players.member[id]);
    this.votes[id] = 0;
  }
  this.member = this.member.sort( function (a,b) { parseInt(a.id) - parseInt(b.id) });
  for ( var i=0;i<this.member.length;i++ ) {
    this.member[i].role = roles[i];
    if ( roles[i] === 'villager' ) {
      this.member[i].word = villagerWord;
    }
    else {
      this.member[i].word = wolfWord;
    }
  }
  this.nextTell = 0;
  this.nextVoter = 0;
}

Village.prototype.tellWord = function () {
  if ( this.nextTell === this.member.length ) {
    return false;
  }
  return this.member[this.nextTell++];
}

Village.prototype.prepareVote = function () {
  if ( this.nextVoter === this.member.length ) {
    return false;
  }
  var candidates = [];
  var voter;
  for ( var i=0;i<this.member.length;i++ ) {
    if ( this.nextVoter === i ) {
      voter = this.member[i];
    }
    else {
      candidates.push(this.member[i]);
    }
  }
  return {
    voter: voter,
    candidates: candidates
  };
}

Village.prototype.vote = function (voterId, candidateId) {
  this.votes[candidateId]++;
  this.voteMap[voterId] = candidateId;
  this.nextVoter++;
}

Village.prototype.judge = function () {
  var max = 0;
  for ( var candidate in this.votes ) {
    var votes = this.votes[candidate];
    if ( max < votes ) max = votes;
  }

  // Check if multiple candidates have win by same votes
  var numWinners = 0;
  var winner;  // I mean winner as the man who would be eliminated. My English...
  for ( var candidate in this.votes ) {
    var votes = this.votes[candidate];
    if ( max === votes ) {
      winner = candidate;
      numWinners++;
    }
  }

  if ( numWinners > 1 ) {
    this.setResult('noBanish');
    return 0;
  }
  else if ( this.players.member[winner].role === 'villager' ) {
    this.setResult('villagerBanished');
  }
  return this.players.member[winner];
};

Village.prototype.banish = function (idx) {
  if ( idx === -1 ) {
    this.setResult('noBanish');
    return 'noBanish';
  }
  var banished = this.players.member[idx];
  if ( banished.role === 'villager' ) {
    this.setResult('villagerBanished');
    return 'villagerBanished';
  }
  else {
    return;
  }
}

Village.prototype.setResult = function (result) {
  if ( result === 'noBanish' ) {
    this.applyScore(-1,1);
  }
  else if ( result === 'villagerBanished' ) {
    this.applyScore(-1,1);
  }
  else if ( result === 'wolfRevenge' ) {
    this.applyScore(-2,-3);
  }
  else if ( result === 'wolfBanished' ) {
    this.applyScore(2,-3);
  }
  else {
    throw('huh?');
  }
  this.result = result;
};

Village.prototype.wolfRevenge = function (success) {
  if ( success ) {
    this.setResult('wolfRevenge');
  }
  else {
    this.setResult('wolfBanished');
  }
};

Village.prototype.applyScore = function (villagerScore, GMScore) {
  var scoreMap = {
    villager: villagerScore,
    master: GMScore,
    wolf: -1 * (villagerScore * this.numVillagers + GMScore) / this.numWolves
  };
  this.scoreMove = {};
  for ( var id in this.players.member ) {
    this.players.member[id].point += scoreMap[ this.players.member[id].role ];
    this.scoreMove[id] = scoreMap[ this.players.member[id].role ];
  }
}

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


if ( 'undefined' !==  typeof window ) {
  window.Players = Players;
  window.Village = Village;
}

if ( 'undefined' !==  typeof module ) {
  module.exports.Players = Players;
  module.exports.Village = Village;
}

})();
