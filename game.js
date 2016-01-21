(function () {

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

function makePlayers (villagerWord, wolfWord, villagers, wolves) {
  var players = [];
  for ( var i=0;i<villagers;i++ ) {
    players.push(villagerWord);
  }
  for ( var i=0;i<wolves;i++ ) {
    players.push(wolfWord);
  }
  return shuffle(players);
}

window.makePlayers = makePlayers;
})();
