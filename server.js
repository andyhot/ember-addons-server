var express = require('express'),
    app = express(),
    cors = require('cors'),
    compression = require('compression'),
    DB = require('./lib/db'),
    dotenv = require('dotenv'),
    csv = require('to-csv');

// load vars
dotenv.load();


app.use(compression());
app.use(cors());

app.use(function(req, res, next) {
  req.db = new DB({
    databaseURL: process.env.DATABASE_URL,
    debug: true
  });
  next();
});

app.get('/', function(req, res) {
  res.redirect(301,
    'https://io-builtwithember-addons-data.s3.amazonaws.com/addons.json');
});

app.get('/stats', function(req, res) {
  req.db.getMetric('total')
    .then(function(rows) {
      res.json(rows);
      req.db.close();
    })
    .catch(function(err) {
      console.error(err);
      res.status(500).json({error: 'error'});
      req.db.close();
    });
});

app.get('/stats.csv', function(req, res) {
  req.db.getMetric('total')
    .then(function(rows) {
      res.set('Content-Type', 'text/csv').send(csv(rows));
      req.db.close();
    })
    .catch(function(err) {
      console.error(err);
      res.status(500).json({error: 'error'});
      req.db.close();
    });
});


app.listen(process.env.PORT, function() {
  console.log('listening on port %d', process.env.PORT);
});
