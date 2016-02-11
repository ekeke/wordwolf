var MongoClient = require('mongodb').MongoClient;
var WW = require('./game.js');
var fs = require('fs');
var socketio = require('socket.io');
var http = require('http');
var online = require('./online.js');

var staticFiles = {
  '/': { content: fs.readFileSync('index.html'), type: 'text/html' },
  '/online': { content: fs.readFileSync('online.html'), type: 'text/html' },
  '/online-client.js': { content: fs.readFileSync('online-client.js'), type: 'text/javascript' },
  '/game.js': { content: fs.readFileSync('game.js'), type: 'text/javascript'},
  '/styles.css': { content: fs.readFileSync('styles.css'), type: 'text/css'},
  '/online.css': { content: fs.readFileSync('online.css'), type: 'text/css'}
};

var mongourl = 'mongodb://localhost:27017/wordwolf';

var server = require('http').createServer(function (req,res) {
  var file = staticFiles[req.url];
  if ( file ) {
    res.writeHead(200, { 'Content-Type': file['type'] });
    res.end(file['content']);
  }
  else if (req.url === '/wordpairs' && req.method === 'GET' ) {
    MongoClient.connect(mongourl, function(err, db) {
      var coll = db.collection('wordpairs');
      coll.count(function(err,count) {
        var skip = parseInt(count * Math.random());
        var cursor = coll.find({});
        cursor.skip(skip);
        cursor.nextObject(function(err,item) {
          var data = { ww: item.ww, vw: item.vw };
          db.close();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        });
      });
    });
  }
  else if (req.url === '/wordpairs' && req.method === 'POST' ) {
    req.on('data', function(chunk) {
      var data = JSON.parse(chunk.toString());
      if ( !data.ww || !data.ww.length || !data.vw || !data.vw.length || data.ww === data.vw ) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"err","Invalid Request"}');
        return;
      }
      MongoClient.connect(mongourl, function(err, db) {
        var coll = db.collection('wordpairs');
        var amount = {};
        amount[ 'results.' + data.result] = 1;
        amount[ 'estimates.age' ] = parseInt(data.age);
        amount[ 'estimates.difficulty' ] = parseInt(data.difficulty);
        coll.updateOne(
          {ww: data.ww, vw: data.vw },
          { $inc: amount },
          { upsert: true },
          function (err,r) {
            db.close();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"err":"'+err+'}');
          }
        );
      });
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(4111);


var io = socketio.listen( server );
var lobby = new online.Lobby();
io.sockets.on( 'connection', function( socket ) {
  var user = new online.User({socket: socket});

});
