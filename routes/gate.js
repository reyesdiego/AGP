/**
 * Created by Diego Reyes on 3/21/14.
 */


module.exports = function (app) {

	var dateTime = require('../include/moment');
	var moment = require('moment');
	var path = require('path');
	var Account = require(path.join(__dirname, '..', '/models/account'));
	var Gate = require('../models/gate.js');

	function getGates(req, res, next){
		'use static';

		var param = {};
		if (req.query.contenedor)
			param.contenedor = req.query.contenedor;
		if (req.query.fecha){
			var fecha = moment(moment(req.query.fecha).format('YYYY-MM-DD'));
			param.gateTimestamp = {$gt: fecha.toString(),$lt:fecha.add('days',1).toString()};
		}

		Gate.find(param).exec( function( err, gates){
			if (err){
				console.log("%s - Error: %s", dateTime.getDatetime(), err.error);
				res.send(400);
			} else {
				res.send(gates);
			}
		})
	}

	function addGate(req, res, next){
		'use static';

		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (err) {
				console.log("%s - Error: %s", dateTime.getDatetime(), err.error);
				res.send(403, {error: err.error});
			} else {
				var gate2insert = req.body;
				gate2insert.terminal = usr.terminal;
				if (gate2insert) {
					Gate.insert(gate2insert, function (errSave, data) {
						if (!errSave){
							console.log('%s - Gate inserted. - %s', dateTime.getDatetime(), usr.terminal);
							res.send(data);
						} else {
							res.send(500, {"error": errSave});
						}
					});
				}
			}
		});
	}

	app.get('/gates', getGates);
	app.post('/gate', addGate);
}