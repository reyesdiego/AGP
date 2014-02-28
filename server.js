/**
 * Created by Diego Reyes on 1/7/14.
 */
var express		= require('express'),
	http		= require('http'),
	mongoose	= require('mongoose'),
	passport	= require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	path		= require('path');

var config = require(__dirname + '/config/config.js');

var app = express();
var server = http.createServer(app);

app.configure(function () {
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(passport.initialize());
	app.use(app.router);
});

app.all('/*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", 'X-Requested-With, Content-Type, token');
	res.header('Access-Control-Allow-Methods', 'GET, POST', 'DELETE', 'PUT', 'OPTIONS');
	res.header('Access-Control-Request-Method', 'GET');
	res.header('Access-Control-Request-Headers', 'token');

	if ('OPTIONS' == req.method) {
		res.send(200);
	}
	else {
		next();
	}
//	next();
});

var Account = require(__dirname +'/models/account');
passport.use(Account.createStrategy());

app.get('/', function(req, res) {
	res.send("Servicio Rest Terminales Portuarias. A.G.P.");
});

mongoose.connect(config.mongo_url, function(err, res) {
	if(err) {
		console.log('ERROR: connecting to Database. ' + err);
	} else {
		console.log('Connected to Database');
	}
});

routes = require('./routes/accounts')(app, passport);
routes = require('./routes/invoice')(app);
routes = require('./routes/price')(app);
routes = require('./routes/matchPrice')(app);

var processArgs = process.argv.slice(2);
var port = processArgs[0] || 8080;
server.listen(port, function() {
	console.log("Node server running on http://localhost:%s", port);
});
