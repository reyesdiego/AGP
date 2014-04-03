/**
 * Created by Diego Reyes on 1/7/14.
 */
var express		= require('express'),
	http		= require('http'),
	mongoose	= require('mongoose'),
	passport	= require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	path		= require('path'),
	moment		= require('moment');



var config = require(__dirname + '/config/config.js');

var app = express();
var server = http.createServer(app);

app.configure(function () {
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(passport.initialize());

});


app.all('/*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", 'X-Requested-With, Content-Type, token');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
//	res.header('Access-Control-Request-Method', 'GET');
	res.header('Access-Control-Request-Headers', 'Content-Type, token');

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
		console.log('%s - ERROR: connecting to Database. %s', moment().format('YYYY-MM-DD HH:MM:SS'), err);
	} else {
		console.log('%s - Connected to Database. %s', moment().format('YYYY-MM-DD HH:MM:SS'), config.mongo_url);
	}
});

//routes = require('./routes/accounts')(app, passport);
routes = require('./routes/accounts')(app);
routes = require('./routes/invoice')(app);
routes = require('./routes/price')(app);
routes = require('./routes/matchPrice')(app);
routes = require('./routes/appointment')(app);
routes = require('./routes/gate')(app);

var processArgs = process.argv.slice(2);
var port = processArgs[0] || config.server_port;
server.listen(port, function() {
	console.log("===================================================================");
	console.log("%s - Node server Version: %s", moment().format('YYYY-MM-DD HH:MM:SS'), process.version);
	console.log("%s - Running on http://localhost:%s", moment().format('YYYY-MM-DD HH:MM:SS'), port);
	console.log("===================================================================");
});
