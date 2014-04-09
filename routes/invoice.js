/**
 * Created by Diego Reyes on 2/17/14.
 */

'use strict';

var path = require('path');
var Account = require(path.join(__dirname, '..', '/models/account'));

var dateTime = require('../include/moment');

/**
 * Created by Diego Reyes on 1/7/14.
 *
 * @module Routes
 */
module.exports = function(app) {

	var Invoice = require('../models/invoice.js');

	//GET - Return all invoice in the DB
	function getInvoices (req, res) {
		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (err){
				console.log(usr);
				res.send(err);
			} else {
				var invoices = Invoice.find({terminal: usr.terminal}).limit(req.params.limit).skip(req.params.skip);
				invoices.exec(function(err, invoices) {
					if(!err) {
						Invoice.count({}, function (err, cnt){
							var result = {
								totalCount: cnt,
								pageCount: req.params.limit,
								page: req.params.skip,
								data: invoices
							}
							res.send(result);
						});
					} else {
						console.log('ERROR: ' + err);
					}
				});
			}
		});
	};

	function getInvoice(req, res){
		var incomingToken = req.headers.token;

		var invoice = Invoice.find({_id: req.params.id})
	}

	function addInvoice ( req, res) {
		var postData = '';
		req.setEncoding("utf8");

		req.addListener("data", function(postDataChunk) {
			postData += postDataChunk;
		});
		req.addListener("end", function() {

			var incomingToken = req.headers.token;
			Account.verifyToken(incomingToken, function(err, usr) {
				try {
					postData = JSON.parse(postData);
				} catch (err){
					console.log("%s - Error: Parsing JSON: %s, JSON:%s", dateTime.getDatetime(), err, postData);
					res.send(400);
					return;
				}

				if (err) {
					console.log("%s - Error: Token: %s", dateTime.getDatetime(), err.error);
					res.send(403);
				} else {
					try {
						var invoice = {
						terminal:		usr.terminal,
						codTipoComprob:	postData.codTipoComprob,
						nroPtoVenta:	postData.nroPtoVenta,
						nroComprob:		postData.nroComprob,
						codTipoAutoriz:	postData.codTipoAutoriz,
						codAutoriz:		postData.codAutoriz,
						fechaVto:		postData.fechaVto,
						codTipoDoc:		postData.codTipoDoc,
						nroDoc:			postData.nroDoc,
						clienteId:		postData.clientId,
						razon:			postData.razon,
						importe:		{
											gravado:		postData.impGrav,
											noGravado:		postData.impNoGrav,
											exento:			postData.impExento,
											subtotal:		postData.impSubtot,
											iva:			postData.impIva,
											otrosTributos:	postData.impOtrosTrib,
											total:			postData.impTotal
										},
						codMoneda:		postData.codMoneda,
						cotiMoneda:		postData.cotiMoneda,
						observa:	 	postData.observa,
						codConcepto:	postData.codConcepto,
						fecha:			{
											emision:	postData.fechaEmision,
											vcto:		postData.fechaVcto,
											desde:		postData.fechaServDesde,
											hasta:		postData.fechaServHasta,
											vctoPago:	postData.fechaVctoPago
										},
						buque:			{
											codigo:	postData.codigo,
											nombre:	postData.nombre,
											viaje:	postData.viaje
										},
						detalle:		[],
						otrosTributos:	[]
						};

						postData.detalle.forEach(function (container){
							var buque = {
								codigo: container.buqueId,
								nombre: container.buqueDesc,
								viaje: container.viaje
							};
							var cont = {
								contenedor:		container.contenedor,
								buque:			buque,
								items: []
							};
							container.items.forEach(function (item){
								cont.items.push(
								{
									id:			item.id,
									cnt:		item.cnt,
									uniMed:		item.uniMed,
									impUnit:	item.impUni,
									impIva:		item.impIva,
									impTot:		item.impTot
								});
							});
							invoice.detalle.push(cont);
						});

					} catch (error){
						res.send(error);
					}

					var invoice2add = new Invoice(invoice);
					invoice2add.save(function (err) {
						if (!err) {
							console.log("%s - Invoice inserted: %s", dateTime.getDatetime(), usr.terminal);
							res.send(invoice2add);
						} else {
							console.log('%s - Error: %s. : %s', dateTime.getDatetime(), err, usr.terminal);
							res.send(400);
						}
					});

//					for () {
//						invoice.otrosTributos.push(
//						{
//							id:			,
//							desc	:	,
//							imponible:	,
//							imp:
//						})
//					}

				}
			});
		});
	};

	function removeInvoices ( req, res){
		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (!err){
				console.log(usr);
				Invoice.remove({_id: req.params._id}, function (err){
					if (!err){
						console.log('Eliminado');
						res.send({"response": "OK"});
					} else {
						res.send({"error": "Error al intentar eliminar"});
					}
				});
			}
			else {
				res.send(err);
			}
		});
	}

	app.get('/invoices/:skip/:limit', getInvoices);
	app.get('/invoice', getInvoice);
	app.post('/invoice', addInvoice);
	app.delete('/invoices/:_id', removeInvoices);

	app.get('/test', function(req, res){
		var incomingToken = req.headers.token;
		Account.verifyToken(incomingToken, function(err, usr) {
			if (err) {
				res.send(err);
			} else {
				console.log(usr);
				res.send({"test": "OK", user: usr});
			}
		});
	})
}