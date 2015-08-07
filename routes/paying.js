/**
 * Created by diego on 7/13/15.
 *
 * @module Paying
 */

module.exports = function (log) {
    'use strict';
    var express = require('express'),
        router = express.Router(),
        Invoice = require('../models/invoice.js'),
        Paying = require('../models/paying.js'),
        priceUtils = require('../include/price.js'),
        moment = require('moment'),
        VoucherType = require('../models/voucherType.js'),
        Enumerable = require('linq');

    function _getNotPayed(req, paginated, callback) {

        var paramTerminal = req.params.terminal,
            invoices,
            price = new priceUtils.price(paramTerminal),
            skip,
            limit,
            order,
            estados,
            desde,
            hasta,
            tipoDeSuma,
            cond;

        if (req.query.fechaInicio === undefined || req.query.fechaFin === undefined) {
            callback({status: "ERROR", message: "Debe proveer parametros de fecha"});
        } else {

            VoucherType.find({type: -1}, function (err, vouchertypes) {
                if (err) {
                    callback({status: "ERROR", message: err.message});
                } else {
                    cond = Enumerable.from(vouchertypes)
                        .select(function (item) {
                            if (item.type === -1) {
                                return {$eq: ["$codTipoComprob", item._id]};
                            }
                        }).toArray();

                    desde = moment(req.query.fechaInicio, 'YYYY-MM-DD').toDate();
                    if (desde < new Date(2015, 1, 0, 0, 0)) {
                        desde = new Date(2015, 1, 0, 0, 0);
                    }
                    hasta = moment(req.query.fechaFin, 'YYYY-MM-DD').add(1, 'days').toDate();

                    if (paginated) {
                        estados = ['todo'];
                        tipoDeSuma = '$detalle.items.impTot';
                    } else {
                        estados = ['E', 'R', 'T'];
                        tipoDeSuma = {
                            $cond: { if: {$or: cond},
                                then: {$multiply: ['$detalle.items.impTot', -1]},
                                else: '$detalle.items.impTot'}
                        };
                    }

                    price.rates(false, function (err, prices) {
                        var param,
                            match;

                        match = {
                            terminal: paramTerminal,
                            'fecha.emision': {$gte: desde, $lt: hasta},
                            'detalle.items.id': {$in: prices},
                            'payment': {$exists: false}
                        };

                        param = [
                            {$match: match },
                            {$project: {
                                terminal: 1,
                                fecha: '$fecha.emision',
                                estado: '$estado',
                                codTipoComprob: 1,
                                nroComprob: 1,
                                nroPtoVenta: 1,
                                detalle: '$detalle',
                                total: '$importe.total'
                            }},
                            {$unwind: '$estado'},
                            {$group: {
                                _id:   {
                                    _id: '$_id',
                                    terminal: '$terminal',
                                    fecha: '$fecha',
                                    nroComprob: '$nroComprob',
                                    codTipoComprob: '$codTipoComprob',
                                    nroPtoVenta: '$nroPtoVenta',
                                    detalle: '$detalle',
                                    total: '$total'
                                },
                                estado: {$last: '$estado'}
                            }},
                            {$project: {
                                '_id': '$_id._id',
                                nroPtoVenta: '$_id.nroPtoVenta',
                                terminal: '$_id.terminal',
                                nroComprob: '$_id.nroComprob',
                                fecha: '$_id.fecha',
                                codTipoComprob: '$_id.codTipoComprob',
                                detalle: '$_id.detalle',
                                totalF: '$_id.total',
                                estado: true
                            }},
                            {$match: {'estado.estado': {$nin: estados}}},
                            {$unwind: '$detalle'},
                            {$unwind: '$detalle.items'},
                            {$match: {'detalle.items.id': {$in: prices}}},
                            {$group: {
                                _id: {
                                    _id: '$_id',
                                    terminal: '$terminal',
                                    nroComprob: '$nroComprob',
                                    nroPtoVenta: '$nroPtoVenta',
                                    codTipoComprob: '$codTipoComprob',
                                    fecha: '$fecha',
                                    estado: '$estado',
                                    code: '$detalle.items.id',
                                    total: '$totalF'
                                },
                                importe: {
                                    $sum: tipoDeSuma
                                },
                                cnt: {$sum : '$detalle.items.cnt'}
                            }},
                            {$project: {
                                _id: '$_id._id',
                                terminal: '$_id.terminal',
                                emision: '$_id.fecha',
                                nroPtoVenta: '$_id.nroPtoVenta',
                                codTipoComprob: '$_id.codTipoComprob',
                                nroComprob: '$_id.nroComprob',
                                code: '$_id.code',
                                tasa: '$importe',
                                total: '$_id.total',
                                cnt: '$cnt',
                                estado: '$_id.estado'
                            }}
                        ];

                        if (req.query.order) {
                            order = JSON.parse(req.query.order);
                            param.push({$sort: order[0]});
                        } else {
                           // param.push({$sort: {'codTipoComprob': 1}});
                        }

                        if (paginated) {
                            limit = parseInt(req.params.limit, 10);
                            skip = parseInt(req.params.skip, 10);
                            param.push({$skip: skip});
                            param.push({$limit: limit});
                        }

                        invoices = Invoice.aggregate(param);
                        invoices.exec(function (err, data) {
                            if (err) {
                                callback(err);
                            } else {
                                if (paginated) {
                                    Invoice.count(match, function (err, count) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            callback(null, {status: "OK", totalCount: count, data: data});
                                        }
                                    });
                                } else {
                                    callback(null, {status: "OK", data: data});
                                }
                            }
                        });
                    });

                }
            });
        }

    }

    function getNotPayed(req, res) {
        var paginated = true;
        _getNotPayed(req, paginated, function (err, data) {
            if (err) {
                res.status(500).send({status: "ERROR", message: err.message, data: null});
            } else {
                res.status(200).send({status: "OK", totalCount: data.totalCount, data: data.data});
            }
        });
    }

    function getPayed(req, res) {
        var invoices,
            skip = parseInt(req.params.skip, 10),
            limit = parseInt(req.params.limit, 10),
            order;

        invoices = Invoice.find({'payment': req.params._id, terminal: req.params.terminal});

        if (req.query.order) {
            order = JSON.parse(req.query.order);
            invoices.sort(order[0]);
        } else {
            invoices.sort({'codTipoComprob': 1, 'nroComprob': 1});
        }
        invoices.skip(skip).limit(limit)

        invoices.exec(function (err, data) {
            if (err) {
                res.status(500).send({
                    status: 'ERROR',
                    message: err.message
                });
            } else {
                Invoice.count({'payment': req.params._id, terminal: req.params.terminal}, function (err, cnt) {
                    var pageCount = data.length,
                        result = {
                            status: 'OK',
                            totalCount: cnt,
                            pageCount: (limit > pageCount) ? pageCount : limit,
                            page: skip,
                            data: data
                        };
                    res.status(200).send(result);
                });
            }
        });
    }

    function add2PrePayment(req, res) {
        var async = require('async'),
            paginated = false,
            invoicesCnt;

        _getNotPayed(req, paginated, function (err, data) {
            if (err) {
                res.status(400).send({status: "ERROR", message: err.message, data: null});
            } else {
                invoicesCnt = data.data.length;
                if (invoicesCnt > 0) {
                    async.forEach(data.data, function (item, callback) {
                        Invoice.update({_id: item._id},
                            {$set: {
                                'payment': req.body.payingId
                            }},
                            function (err, rowAffected, data) {
                                callback();
                            });
                    }, function () {
                        res.status(200).send({status: "OK",  message: "Se agregaron " + invoicesCnt.toString() + " a la preliquidación."});
                    });
                } else {
                    res.status(500).send({
                        status: 'ERROR',
                        data: null,
                        message: "No hay comprobantes sin Liquidar."
                    });
                }
            }
        });
    }

    function getPrePayment(req, res) {
        var param,
            totalPayment,
            price,
            cond,
            mongoose = require("mongoose");

        var _id = mongoose.Types.ObjectId(req.params._id);

        VoucherType.find({type: -1}, function (err, vouchertypes) {
            if (err) {
                callback({status: "ERROR", message: err.message});
            } else {
                cond = Enumerable.from(vouchertypes)
                    .select(function (item) {
                        if (item.type === -1) {
                            return {$eq: ["$codTipoComprob", item._id]};
                        }
                    }).toArray();

                price = new priceUtils.price(req.params.terminal);
                price.rates(false, function (err, rates) {
                    param = [
                        {$match: {terminal: req.params.terminal, "payment": _id}},
                        {$project: {terminal: 1,
                            codTipoComprob: 1,
                            nroComprob: 1,
                            number: '$payment.number',
                            detalle: '$detalle'
                        }},
                        {$unwind: '$detalle'},
                        {$unwind: '$detalle.items'},
                        {$match: {'detalle.items.id': {$in: rates }}},
                        {$project: {
                            terminal: 1,
                            code: '$detalle.items.id',
                            nroComprob: 1,
                            number: 1,
                            cnt: '$detalle.items.cnt',
                            importe: {
                                $cond: { if: {  $or: cond },
                                    then: {$multiply: ['$detalle.items.impTot', -1]},
                                    else: '$detalle.items.impTot'}
                            }
                        }},
                        {$group: {
                            _id: {number: '$number'},
                            toneladas: {$sum: '$cnt'},
                            importe: {$sum: '$importe'}
                        }},
                        {$project: {
                            number: '$_id.number',
                            tons: '$toneladas',
                            total: '$importe'
                        }}
                    ];
                    totalPayment = Invoice.aggregate(param);
                    totalPayment.exec(function (err, totalPayment) {
                        if (err) {
                            res.status(500).send(
                                {
                                    status: "ERROR",
                                    message: "Ha ocurrido un error al obtener los datos de la pre liquidación."
                                }
                            );
                        } else {
                            res.status(200).send(
                                {
                                    status: "OK",
                                    data: totalPayment
                                }
                            );
                        }
                    });
                });

            }
        });

    }

    function setPrePayment(req, res) {
        var param,
            payment,
            paramTerminal,
            nextPaymentNumber;

        paramTerminal = req.body.terminal;

        param = [{$match: {terminal: paramTerminal}}, {$group: {_id: '', max: {$max: '$preNumber'}}}];
        payment = Paying.aggregate(param);
        payment.exec(function (err, maxNumber) {
            nextPaymentNumber = 0;
            if (maxNumber.length > 0) {
                nextPaymentNumber = maxNumber[0].max;
            }
            Paying.create({
                terminal: paramTerminal,
                date: moment(req.body.fecha, 'YYYY-MM-DD HH:mm:SS Z').toDate(),
                preNumber: ++nextPaymentNumber,
                vouchers: 0,
                tons: 0,
                total: 0
            }, function (err, newPaying) {
                if (err) {
                    res.status(500).send({status: "ERROR", message: err.message});
                } else {
                    res.status(200).send({status: "OK", data: newPaying});
                }
            });
        });
    }

    function setPayment(req, res) {
        var param,
            payment,
            paramTerminal,
            nextPaymentNumber;

        paramTerminal = req.body.terminal;

        param = [{$match: {terminal: paramTerminal}}, {$group: {_id: '', max: {$max: '$number'}}}];
        payment = Paying.aggregate(param);
        payment.exec(function (err, maxNumber) {
            nextPaymentNumber = 0;
            if (maxNumber.length > 0) {
                nextPaymentNumber = maxNumber[0].max;
            }
            Paying.update({terminal: paramTerminal, preNumber: req.body.preNumber},
                {$set: {number: nextPaymentNumber, date: Date.now()}},
                function (err, payment, rowAfected) {
                    res.status(200).send({status: "OK", data: payment});
            });
        });
    }

    function getPayments(req, res) {
        var paying,
            skip = parseInt(req.params.skip, 10),
            limit = parseInt(req.params.limit, 10),
            paramTerminal = req.params.terminal;

        paying = Paying.find({terminal: paramTerminal});
        paying.skip(skip);
        paying.limit(limit);
        paying.exec(function (err, payings) {
            if (err) {
                res.status(500).send({
                    status: 'ERROR',
                    message: err.message,
                    data: null
                });
            } else {
                Paying.count({terminal: paramTerminal}, function (err, cnt) {
                    var pageCount = payings.length,
                        result = {
                            status: 'OK',
                            totalCount: cnt,
                            pageCount: (limit > pageCount) ? pageCount : limit,
                            page: skip,
                            data: payings
                        };
                    res.status(200).send(result);
                });
            }
        });
    }

    router.get('/payed/:terminal/:_id/:skip/:limit', getPayed);
    router.get('/notPayed/:terminal/:skip/:limit', getNotPayed);
    router.get('/payments/:terminal/:skip/:limit', getPayments);

    router.post('/prePayment', setPrePayment);
    router.put('/payment', setPayment);
    router.get('/getPrePayment/:terminal/:_id', getPrePayment);
    router.put('/addToPrePayment/:terminal', add2PrePayment);

    return router;
}
