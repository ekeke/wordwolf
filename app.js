var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');

var staticFiles = {
  '/': { content: fs.readFileSync('index.html'), type: 'text/html' },
  '/game.js': { content: fs.readFileSync('game.js'), type: 'text/javascript'},
  '/styles.css': { content: fs.readFileSync('styles.css'), type: 'text/css'}
};

var mongourl = 'mongodb://localhost:27017/wordwolf';

var server = require('http').createServer(function (req,res) {
  var file = staticFiles[req.url];
  if ( file ) {
    res.writeHead(200, { 'Content-Type': file['type'] });
    res.end(file['content']);
  }
  else if (req.url === '/wordpairs' && req.method === 'POST' ) {
    req.on('data', function(chunk) {
      var data = JSON.parse(chunk.toString());
      MongoClient.connect(mongourl, function(err, db) {
        var coll = db.collection('wordpairs');
        var amount = {};
        amount[ 'results.' + data.result] = 1;
        amount[ 'estimates.fun' ] = parseInt(data.fun);
        amount[ 'estimates.age' ] = parseInt(data.age);
        amount[ 'estimates.difficulty' ] = parseInt(data.difficulty);
        coll.updateOne(
          {ww: data.ww, vw: data.vw },
          { $inc: amount },
          { upsert: true },
          function (err,r) {
            db.close();
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
