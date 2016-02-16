( function () {

var log = function (str) {
  $('#plain-log').append( $('<li />').text(str) );
};

function Client (opts) {
  this.init(opts);
}

Client.prototype.init = function (opts) {
  var socket = this.socket = opts.io.connect(opts.server);
  var client = this;

  socket.on('said', function (data) {
    var text = '[' + data.by + '] ' + data.string;
    $('<div />').addClass('timeline-item').text(text).prependTo(
      data.at === 0 ? $('#lobby-timeline') : $('#village-timeline')
    );
  });

  socket.on('welcome', function (data) {
    client.uid = data.id;
    $('.js-my-name').text(data.name);
  });

  socket.on('entered', function (data) {
    if ( data.type === 'village' ) {
      socket.emit('fetchMembers');
      client.currentVillage = data.id;
      $('#village-wrapper').show();
      $('#lobby-wrapper').hide();
      $('#village-name').text(data.name);
      $('#village-timeline').empty();
      $('#setting-village-name').val(data.name);
      $('#setting-discussion-minutes').val(5);
      $('body').addClass('lobby').removeClass('village');
    }
    else {
      socket.emit('listVillage');
      delete client.currentVillage;
      $('#village-wrapper').hide();
      $('#lobby-wrapper').show();
      $('#village-name').text('ロビー');
      $('body').removeClass('lobby').addClass('village');
    }
  });

  socket.on('listVillage', function (data) {
    console.log('listvillage',data);
    var $list = $('#village-list').empty();
    for ( var i=0;i<data.length;i++ ) {
      var village = data[i];
      var $a = $('<a />')
        .addClass('js-join-village')
        .attr('data-village-id', village.id)
        .attr('href', '#')
        .text(village.name);
      $('<li />').append($a).appendTo($list);
    }
  });

  socket.on('listMember', function (data) {
    var $list = $('#member-list').empty();
    var $votelist = $('.js-user-list-for-vote').empty();
    $('.js-for-master').hide();
    $('.js-for-player').show();
    var members = 0;
    for ( var i=0;i<data.length;i++ ) {
      members++;
      var user = data[i];
      var prefix = '';
      if ( parseInt(user.id) === parseInt(client.uid) ) {
        //prefix = '*';
      }
      if ( user.isOwner ) {
        prefix += '&#x1F3E0;';
        if ( parseInt( user.id ) === parseInt( client.uid ) ) {
          $('.js-for-owner').show();
        }
        else {
          $('.js-for-owner').hide();
        }
      }
      if ( user.isMaster ) {
        prefix += '&#128081;';
        if ( parseInt( user.id ) === parseInt( client.uid ) ) {
          $('.js-for-master').show();
          $('.js-for-player').hide();
        }
      }

      var name = prefix + $('<span />').text(user.name).html(); // quick escape
      var $li = $('<li />')
        .attr('data-user-id', user.id)
        .html(name)
        .appendTo($list);
    }

    for ( var i=0;i<data.length;i++ ) {
      var user = data[i];
      var prefix = '';
      if ( parseInt(user.id) === parseInt(client.uid) ) {
        continue;
      }
      if ( user.isMaster ) {
        continue;
      }
      var $a = $('<a />')
        .addClass('js-vote')
        .attr('data-user-id', user.id)
        .attr('href', '#')
        .text(user.name);
      var $li = $('<li />')
        .append($a)
        .appendTo($votelist);
    }

    if ( members < 4 ) {
      $('.js-start').hide();
    }
    else {
      $('.js-start').show();
    }
  });

  socket.on('progress', function (data) {
    $('.js-village-screen').hide();
    setTimeout( function () {
      $('.js-village-screen-' + data.status).fadeIn(300);
    },10);
    client.status = data.status;
    if ( data.status === 'voting' ) {
      $('.js-user-list-for-vote').show();
      $('.js-voted').hide();
    }
    if ( data.status === 'revenge' || data.status === 'postmortem' ) {
      $('.js-for-role').hide();
      $('.js-for-role-' + data.yourrole).show();
      if ( data.banished ) {
        $('.js-banished-name').text(data.banished);
      }
    }
    if ( data.status === 'prebuild' || data.status === 'vote' ) {
      $('.js-village-timeline-wrapper').hide();
    }
    else {
      $('.js-village-timeline-wrapper').show();
    }
    if ( data.status === 'discussing' ) {
      $('#village-timeline').empty();
    }
    if ( data.status === 'vote' ) {
      $('.js-chat-input').blur();
    }

    var timeoutStatus = {
      discussing: 1,
      voting: 1,
      postmortem: 1
    };
    if ( timeoutStatus[data.status] ) {
      $('.js-timeout').show();
      socket.emit('untilTimeout');
    }
    else {
      $('.js-timeout').hide();
    }
  });

  socket.on('untilTimeout', function (ms) {
    if ( ms === -1 ) {
    }
    else {
      client.timeoutLimit = 11;
      client.ms = ms;
      client.showTimeout();
    }
  });

  socket.on('tellword', function (theword) {
    $('.js-the-word').text(theword);
  });

  socket.on('result', function (result) {
    client.result = result;
    $('.js-result').hide();
    $('.js-result-' + result.result).show();
    $('.js-result-role-' + result.yourrole).show();
    $('.js-villager-word').text( result.vw );
    $('.js-wolf-word').text( result.ww );
    if ( result.yourresult ) {
      $('.js-result-' + result.yourresult).show();
    }
    var table = client.buildResultTable(result);
    $('.js-result-table-wrapper').empty().append(table);
  });
};

Client.prototype.send = function (type,msg) {
  if ( this.socket ) {
    this.socket.emit(type,msg);
  }
  else {
    throw('message was sent for closed socket');
  }
};

Client.prototype.createVillage = function (opts) {
  this.socket.emit('createVillage',opts);
};

Client.prototype.joinVillage = function (vid) {
  this.socket.emit('joinVillage', vid);
  $('.js-for-master').hide();
  $('.js-for-player').show();
};

Client.prototype.leaveVillage = function () {
  this.socket.emit('leaveVillage');
  $('.js-for-master').hide();
  $('.js-for-player').show();
};

Client.prototype.buildVillage = function (opts) {
  this.socket.emit('buildVillage',opts);
};

Client.prototype.start = function () {
  this.socket.emit('start');
};

Client.prototype.commitWordpair = function (ww,vw) {
  this.isMaster = true;
  $('.js-for-master').show();
  $('.js-for-player').hide();
  this.socket.emit('commitWordpair', { ww: ww, vw: vw });
};

Client.prototype.rebuild = function (opts) {
  this.socket.emit('rebuildVillage');
};

Client.prototype.vote = function (id) {
  this.socket.emit('vote', id);
};

Client.prototype.judgeRevenge = function (result) {
  this.socket.emit('judgeRevenge', result ? 'success' : 'fail');
};

Client.prototype.showTimeout = function () {
  clearTimeout(this.timeoutTimer);
  var client = this;
  var sec = parseInt(this.ms / 1000);
  $('.js-timeout').text(sec);
  if ( sec === 0 ) {
    return;
  }
  this.timeoutLimit--;
  if ( this.timeoutLimit < 1 ) {
    this.socket.emit('untilTimeout');
    return;
  }
  var ms = this.ms - (1000 * sec);
  if ( ms === 0 ) ms = 1000;
  this.ms -= ms;
  client.timeoutTimer = setTimeout( function () {
    client.showTimeout();
  }, ms);
};

Client.prototype.setName = function (name) {
  this.socket.emit('setName', name);
};

Client.prototype.postWordpair = function (vw,ww) {
  $.ajax({
    data: JSON.stringify({
      ww: this.result.ww,
      vw: this.result.vw,
      result: this.result.result,
      difficulty: $('.estimate.difficulty:checked').val(),
      age: $('.estimate.age:checked').val(),
    }),
    method: 'POST',
    url: '/wordpairs'
  });
};

Client.prototype.buildResultTable = function (result) {
  var $table = $('<table />');
  var roleTrans = {
    wolf: '人狼',
    master: 'GM',
    villager: '村人'
  };
  var $row = $('<tr />');
  $('<th />').text('名前').appendTo($row);
  $('<th />').text('役職').appendTo($row);
  $('<th />').text('投票先').appendTo($row);
  $row.appendTo($table);
  for ( var uid in result.roleMap ) {
    var $row = $('<tr />').appendTo($table);
    $('<td />').text( result.playerMap[uid] ).appendTo($row);
    $('<td />').text( roleTrans[ result.roleMap[uid] ] ).appendTo($row);
    $('<td />').text( result.playerMap[ result.voteMap[uid] ] ).appendTo($row);
  }
  return $table;
};

window.Client = Client;

})();
