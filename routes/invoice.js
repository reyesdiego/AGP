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
				res.send({status:'ERROR', data: err});
			} else {
				var invoices = Invoice.find({terminal: usr.terminal}).limit(req.params.limit).skip(req.params.skip).sort({nroComprob:1});
				invoices.exec(function(err, invoices) {
					if(!err) {
						Invoice.count({terminal: usr.terminal}, function (err, cnt){
							var result = {
								status: 'OK',
								totalCount: cnt,
								pageCount: req.params.limit,
								page: req.params.skip,
								data: invoices
							}
							res.send(200, result);
						});
					} else {
						console.log("%s - Error: %s", dateTime.getDatetime(), err.error);
						res.send(500 , {status: "ERROR", data: err});
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
				} catch (errParsing){
					console.log("%s - Error: Parsing JSON: %s, JSON:%s", dateTime.getDatetime(), errParsing, postData);
					res.send(500, {status:"ERROR", data: errParsing.toString()} );
					return;
				}

				if (err) {
					console.log("%s - Error: %s", dateTime.getDatetime(), err.error);
					res.send(403, {status: "ERROR", data: err.error});
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
							if (container.items){
								container.items.forEach( function (item){
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
							} else {
								res.send(500, {"status":"ERROR", "data": "El contenedor no posee items."});
								return;
							}
							invoice.detalle.push(cont);
						});

					} catch (error){
						res.send(500, {"status":"ERROR", "data": error.message});
						return;
					}

					var invoice2add = new Invoice(invoice);
					invoice2add.save(function (errSave, data, rowsAffected) {
						if (!errSave) {
							console.log("%s - Invoice INS:%s - %s", dateTime.getDatetime(), data._id, usr.terminal);
							res.send(200,{"status": "OK", "data": data});
						} else {
							var date = new Date();
							console.log('%s - Error: %s', dateTime.getDatetime(), errSave);
							res.send(500, {"status": "ERROR", "data": errSave});
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