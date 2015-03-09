/**
 * Created by diego on 12/10/14.
 */

module.exports = function (log){

	var express = require('express');
	var router = express.Router();

	function getStates(req, res, next){
		var State = require('../models/state.js');

		State.find({}, function (err, data){
			if (err){
				res.status(500).send({status:"ERROR", data: err.message});
			} else {
				var result = data;
				if (req.query.type === 'array'){
					result={};
					data.forEach(function (item){
						result[item._id] = {
							name: item.name,
							description: item.description,
							type: item.type
						};
					});
				}
				var response = {
					status:		'OK',
					totalCount:	data.length,
					data: result
				};
				res.status(200).json(response);
			}
		});
	}

	router.all(function (req, res, next){
		log.logger.info('Time: %s', Date.now());
		next();
	});

	router.get('/', getStates);
	return router;


	//app.get('/states', getStates);
}