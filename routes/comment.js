/**
 * Created by diego on 9/5/14.
 */

module.exports = function (app, io, log) {

	var util = require('util');
	var dateTime = require('../include/moment');

	var path = require('path');
	var Account = require(path.join(__dirname, '..', '/models/account'));
	var Invoice = require('../models/invoice.js');
	var Comment = require('../models/comment.js');

	function getComments(req, res) {
		'use strict';

		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (err){
				log.logger.error(usr);
				res.send(403, {status:'ERROR', data: err});
			} else {
				var param = {
					invoice: req.params._id
				};

				var comment = Comment.find(param);
				comment.sort({_id: -1})
				comment.exec(function(err, comments){
					if (err) {
						log.logger.error("Error: %s", err.error);
						res.send({status:'ERROR', data: err});
					} else {
						res.send(200, {status:"OK", data: comments||null})
					}
				});
			}
		});
	}

	function addComment (req, res) {
		'use strict';

		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (err) {
				log.logger.error("Error: %s", err.error);
				res.send(403, {status:"ERROR", data: err.error});
			} else {
				req.body.user = usr.user;
				req.body.group = usr.group;
				Comment.create(req.body, function (err, commentInserted) {
					if (err){
						log.logger.error("Error Comment INS: %s", err.errors);
						res.send(500, {status:"ERROR", data: err.errors});
					} else {

						Invoice.findOne({_id: req.body.invoice}, function (err, invoice) {
							invoice.comment.push(commentInserted._id);
							invoice.save(function (err){
								if (err){
									log.logger.error("Error Invoice UPD Adding Comment : %s", err.errors);
									res.send(500, {status:"ERROR", data: err.errors});
								} else {
									res.send(200, {status: 'OK', data: commentInserted});
								}
							});
						});
					}
				});
			}
		});
	}

	app.get('/invoice/:_id/comments', getComments);
	app.post('/comment', addComment);
};

