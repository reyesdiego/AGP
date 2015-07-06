/**
 * Created by Diego Reyes on 1/7/14.
 *
 * @module Routes
 */
module.exports = function(log, io, pool) {
    'use strict';

    var express = require('express'),
        router = express.Router(),
        util = require('util'),
        moment = require('moment'),
        config = require('../config/config.js'),
        Invoice = require('../models/invoice.js'),
        Gate = require('../models/gate.js'),
        MatchPrice = require('../models/matchPrice.js'),
        Enumerable = require('linq'),
        oracledb = require('oracledb');

    //GET - Return all invoice in the DB
    function getInvoices(req, res) {

        var usr = req.usr,
            paramTerminal = req.params.terminal,
            fecha,
            limit = parseInt(req.params.limit, 10),
            skip = parseInt(req.params.skip, 10),
            ter = (usr.role === 'agp') ? paramTerminal : usr.terminal,
            param = {
                terminal: ter
            },
            states,
            invoices,
            order;

        if (req.query.fechaInicio || req.query.fechaFin) {
            param["fecha.emision"] = {};
            if (req.query.fechaInicio) {
                fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD 00:00:00 Z'));
                param["fecha.emision"]['$gte'] = fecha;
            }
            if (req.query.fechaFin) {
                fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD 00:00:00 Z'));
                param["fecha.emision"]['$lte'] = fecha;
            }
        }
        if (req.query.nroPtoVenta) {
            param.nroPtoVenta = req.query.nroPtoVenta;
        }
        if (req.query.codTipoComprob) {
            param.codTipoComprob = req.query.codTipoComprob;
        }
        if (req.query.nroComprobante) {
            param.nroComprob = req.query.nroComprobante;
        }
        if (req.query.razonSocial) {
            param.razon = {$regex: req.query.razonSocial};
        }
        if (req.query.documentoCliente) {
            param.nroDoc = req.query.documentoCliente;
        }

        if (req.query.contenedor) {
            param['detalle.contenedor'] = req.query.contenedor;
        }

        if (req.query.buqueNombre) {
            param['detalle.buque.nombre'] = req.query.buqueNombre;
        }

        if (req.query.viaje) {
            param['detalle.buque.viaje'] = req.query.viaje;
        }

        if (req.query.code) {
            param['detalle.items.id'] = req.query.code;
        }

        if (req.query.estado) {
            states = req.query.estado.split(",");
            param['$or'] = [
                { estado: {$size: 1, $elemMatch: {estado: {$in: states}, grupo: 'ALL'} } },
                { 'estado.1': { $exists: true }, estado: {$elemMatch: {estado: {$in: states}, grupo: usr.group} } }
            ];
        }

        invoices = Invoice.find(param);

        invoices.skip(skip).limit(limit);
        if (req.query.order) {
            order = JSON.parse(req.query.order);
            invoices.sort(order[0]);
        } else {
            invoices.sort({codTipoComprob: 1, nroComprob: 1});
        }

        invoices.exec(function (err, invoices) {
            if (!err) {
                Invoice.count(param, function (err, cnt) {
                    var pageCount = invoices.length,
                        result = {
                            status: 'OK',
                            totalCount: cnt,
                            pageCount: (limit > pageCount) ? pageCount : pageCount,
                            page: skip,
                            data: invoices
                        };
                    res.status(200).send(result);
                });
            } else {
                log.logger.error("%s", err.message);
                res.status(500).send({status: "ERROR", data: err.message});
            }
        });
    }

    function getInvoice(req, res) {
        var usr = req.usr,
            param = {
                _id: req.params.id
            };

        if (usr.role !== 'agp')
            param.terminal = usr.terminal;

        var invoice = Invoice.find(param);
        invoice.exec(function(err, invoices){
            if (err) {
                log.logger.error("%s", err.error);
                res.status(500).send({status:'ERROR', data: err});
            } else {
                res.status(200).send({status:"OK", data: invoices[0]||null})
            }
        });
    }

    function getCounts(req, res) {

        var jsonParam = [],
            match = {$match: {}},
            fechaEmision = moment(moment().format('YYYY-MM-DD')).toDate(),
            tomorrow,
            Enumerable,
            response;

        if (req.query.fecha !== undefined) {
            fechaEmision = moment(moment(req.query.fecha).format('YYYY-MM-DD')).toDate();
        }
        tomorrow = moment(fechaEmision).add('days', 1).toDate();
        match['$match'] = {'fecha.emision' : {$gte: fechaEmision, '$lt': tomorrow}};
        jsonParam.push(match);

        /*
         var mongoose = require('mongoose');
         if (req.query.fechaTransferencia){
         var objIdToday = dateTime.getObjectId0000(req.query.fechaTransferencia);
         var objIdTomorrow = dateTime.getObjectId0000(moment(req.query.fechaTransferencia).add('days',1));

         match['_id'] = {
         $gte: mongoose.Types.ObjectId(objIdToday),
         $lt: mongoose.Types.ObjectId(objIdTomorrow)
         };
         }
         */

        jsonParam.push({
            $group: {
                _id: {terminal: '$terminal', codTipoComprob: '$codTipoComprob'},
                total: {$sum: '$importe.total'},
                cnt: {$sum: 1}
            }
        });
        jsonParam.push({$project : {_id: false, terminal: '$_id.terminal', codTipoComprob: '$_id.codTipoComprob', cnt : '$cnt'}});
        jsonParam.push({$sort: {'terminal': 1, 'codTipoComprob': 1}});

        Invoice.aggregate(jsonParam, function (err, data) {
            if (!err) {

                Enumerable = require('linq');
                response = Enumerable.from(data)
                    .groupBy(function (item) {
                        return item.codTipoComprob;
                    },
                        function (item) {
                            return item;
                        },
                        function (job, grouping) {
                            var grupo = grouping.getSource(),
                                tot = grouping.sum(function (item) {
                                    return item.cnt;
                                }),
                                grupoItem = {
                                    codTipoComprob: job,
                                    total: tot
                                };

                            grupo.forEach(function (item) {
                                var porcen = item.cnt * 100 / tot;
                                grupoItem[item.terminal] = [item.cnt, porcen];
                            });

                            return grupoItem;
                        }).toArray();

                res.status(200).send({status: "OK", data: response});
            } else {
                log.logger.error(err);
                res.status(500).send({status: 'ERROR', data: err.message});
            }
        });
    }

    function getCountByDate(req, res) {

        var date = moment(moment().format('YYYY-MM-DD')),
            date5Ago,
            tomorrow,
            sum = {},
            jsonParam,
            result;

        if (req.query.fecha !== undefined) {
            date = moment(moment(req.query.fecha).format('YYYY-MM-DD'));
        }
        date5Ago = moment(date).subtract('days', 4).toDate();
        tomorrow = moment(date).add('days', 1).toDate();


        if (req.params.currency === 'PES') {
            sum = { $cond: [
                {$eq: ['$codMoneda', 'PES' ]},
                '$importe.total',
                {$multiply: ['$importe.total', '$cotiMoneda'] }
            ]};
        } else if (req.params.currency === 'DOL') {
            sum = { $cond: [
                {$eq: ['$codMoneda', 'DOL' ]},
                '$importe.total',
                {$divide: ['$importe.total', '$cotiMoneda'] }
            ]};
        }

        jsonParam = [
            {$match: { 'fecha.emision': {$gte: date5Ago, $lt: tomorrow} }},
            { $project: {'accessDate': {$subtract: ['$fecha.emision', 180 * 60 * 1000]}, terminal: '$terminal', total: sum} },
            { $group : {
                _id : { terminal: '$terminal',
                    year: { $year : "$accessDate" },
                    month: { $month : "$accessDate" },
                    day: { $dayOfMonth : "$accessDate" },
                    date: '$accessDate'
                },
                cnt : { $sum : 1 },
                total: { $sum : '$total'}
            }},
            { $sort: {'_id.date': 1, '_id.terminal': 1 }}
        ];

        result = Invoice.aggregate(jsonParam);

        result.exec(function (err, data) {
            if (err) {
                res.status(500).send({status: "ERROR", data: err.message});
            } else {
                res.status(200).send({status: 'OK', data: data});
            }
        });
    }

    function getCountByMonth(req, res) {

        var date = moment(moment().format('YYYY-MM-DD')).subtract('days', moment().date() - 1),
            month5Ago,
            nextMonth,
            sum = {},
            jsonParam;

        if (req.query.fecha !== undefined) {
            date = moment(req.query.fecha, 'YYYY-MM-DD').subtract('days', moment(req.query.fecha).date() - 1);
        }
        month5Ago = moment(date).subtract('months', 4).toDate();
        nextMonth = moment(date).add('months', 1).toDate();


        if (req.params.currency === 'PES') {
            sum = { $cond: [
                {$eq: ['$codMoneda', 'PES' ]},
                '$importe.total',
                {$multiply: ['$importe.total', '$cotiMoneda'] }
            ]};
        } else if (req.params.currency === 'DOL') {
            sum = { $cond: [
                {$eq: ['$codMoneda', 'DOL' ]},
                '$importe.total',
                {$divide: ['$importe.total', '$cotiMoneda'] }
            ]};
        }

        jsonParam = [
            {$match: { 'fecha.emision': {$gte: month5Ago, $lt: nextMonth} }},
            { $project: {'accessDate': {$subtract: ['$fecha.emision', 180 * 60 * 1000]}, terminal: '$terminal', total: sum} },
            { $group : {
                _id : { terminal: '$terminal',
                    year: { $year : "$accessDate" },
                    month: { $month : "$accessDate" }
                },
                cnt : { $sum : 1 },
                total: { $sum : '$total'}
            }},
            { $sort: {'_id.month': 1, '_id.terminal': 1 }}
        ];

        Invoice.aggregate(jsonParam, function (err, data) {
            if (err) {
                res.status(500).send({status: "ERROR", data: err.message});
            } else {
                res.status(200).send({status: 'OK', data: data});
            }
        });
    }

    function getNoRates(req, res) {

        log.startElapsed();

        var terminal = req.params.terminal,
            _price = require('../include/price.js'),
            _rates = new _price.price(terminal),
            skip,
            limit,
            fecha,
            param,
            invoices,
            errorResult;

        _rates.rates(function (err, rates) {

            if (rates.length > 0) {

                skip = parseInt(req.params.skip, 10);
                limit = parseInt(req.params.limit, 10);


                param = {
                    terminal : terminal,
                    'detalle.items.id': {$nin: rates}
                };

                if (req.query.fechaInicio || req.query.fechaFin) {
                    param["fecha.emision"] = {};
                    if (req.query.fechaInicio) {
                        fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD HH:mm Z'));
                        param["fecha.emision"]['$gte'] = fecha;
                    }
                    if (req.query.fechaFin) {
                        fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD HH:mm Z'));
                        param["fecha.emision"]['$lte'] = fecha;
                    }
                }

                if (req.query.contenedor) {
                    param['detalle.contenedor'] = req.query.contenedor;
                }

                if (req.query.razonSocial) {
                    param.razon = {$regex: req.query.razonSocial};
                }

                invoices = Invoice.find(param);
                invoices.limit(limit).skip(skip);

                if (req.query.order) {
                    var order = JSON.parse(req.query.order);
                    invoices.sort(order[0]);
                } else {
                    invoices.sort({codTipoComprob: 1, nroComprob: 1});
                }

                invoices.exec(function (err, invoices) {
                    var pageCount = invoices.length;
                    Invoice.count(param, function (err, cnt) {
                        var dataResult = {
                            status: 'OK',
                            totalCount: cnt,
                            pageCount: (limit > pageCount) ? limit : pageCount,
                            page: skip,
                            elapsed: log.getElapsed(),
                            data: invoices
                        };
                        res.status(200).send(dataResult);
                    });
                });
            } else {
                errorResult = {
                    status: 'ERROR',
                    data: 'La terminal no tiene Tasa a las Cargas Asociadas.'
                };
                res.status(500).send(errorResult);
            }
        });
    }

    function getRatesTotal(req, res) {

        var moment = require('moment'),
            today = moment(moment().format('YYYY-MM-DD')).toDate(),
            tomorrow = moment(moment().format('YYYY-MM-DD')).add('days', 1).toDate(),
            _price,
            _rates,
            sum = {},
            jsonParam;

        if (req.query.fecha !== undefined) {
            today = moment(moment(req.query.fecha).format('YYYY-MM-DD')).toDate();
            tomorrow = moment(moment(req.query.fecha).format('YYYY-MM-DD')).add('days', 1).toDate();
        }

        _price = require('../include/price.js');
        _rates = new _price.price();
        _rates.rates(function (err, rates) {

            if (req.params.currency === 'PES') {
                sum = { $cond: [
                    {$eq: ['$codMoneda', 'PES' ]},
                    '$detalle.items.impTot',
                    {$multiply: ['$detalle.items.impTot', '$cotiMoneda'] }
                ]};
            } else if (req.params.currency === 'DOL') {
                sum = { $cond: [
                    {$eq: ['$codMoneda', 'DOL' ]},
                    '$detalle.items.impTot',
                    {$divide: ['$detalle.items.impTot', '$cotiMoneda'] }
                ]};
            }

            jsonParam = [
                {$match : {'fecha.emision': {$gte: today, $lt: tomorrow}}},
                {$unwind : '$detalle'},
                {$unwind : '$detalle.items'},
                {$match : {'detalle.items.id' : {$in: rates}}},
                {$project : {terminal: 1, 'detalle.items': 1, "total" : sum }},
                {
                    $group  : {
                        _id: { terminal: '$terminal'},
                        cnt: { $sum: 1},
                        total: {$sum: '$total'}
                    }
                }
            ];
            Invoice.aggregate(jsonParam, function (err, data) {
                if (err) {
                    res.status(500).send({status: 'ERROR', data: err.message });
                } else {
                    res.status(200)
                        .send({
                            status: 'OK',
                            data: data
                        });
                }
            });
        });
    }

    function getRatesLiquidacion(req, res) {

        var today = moment(moment().format('YYYY-MM-DD')).toDate(),
            tomorrow = moment(moment().format('YYYY-MM-DD')).add('days', 1).toDate(),
            _price,
            _rates;

        if (req.query.fecha !== undefined) {
            today = moment(moment(req.query.fecha).format('YYYY-MM-DD')).toDate();
            tomorrow = moment(moment(req.query.fecha).format('YYYY-MM-DD')).add('days', 1).toDate();
        }

        _price = require('../include/price.js');
        _rates = new _price.price();
        _rates.rates(function (err, rates) {
            var invoice;
            if (err) {
                res.status(500).send({status: 'ERROR', data : err.message});
            } else {
                invoice = Invoice.aggregate([
                    { $match : {
                        'fecha.emision': today,
                        codTipoComprob : {$in : [1]}
                    }},
                    { $unwind : '$detalle'},
                    { $unwind : '$detalle.items'},
                    { $match : {
                        'detalle.items.id' : { $in : rates}
                    }},
                    { $group : {
                        _id : {
                            code : '$detalle.items.id',
                            terminal : '$terminal',
                            fecha : '$fecha.emision'
                        },
                        ton : {$sum : '$detalle.items.cnt'},
                        total : {$sum: '$detalle.items.impTot'}
                    }}]);

                invoice.exec(function (err, data) {
                    if (err) {
                        res.status(500).send({status: 'ERROR', data : err.message});
                    } else {

                        var mp = MatchPrice.find({match: {$in: rates}}, {price: true, match : true});
                        mp.populate({path: 'price', match: {rate: {$exists: 1}}});
                        mp.exec(function (err, dataMatch) {

                            mp = Enumerable.from(dataMatch)
                                .select(function (item) {
                                    return {code: item.match[0], rate: item.price.toObject().rate};
                                }).toArray();
                            mp = Enumerable.from(data)
                                .join(Enumerable.from(mp), '$._id.code', '$.code', function (left, right){
                                    return {
                                        code : right.code,
                                        rate: right.rate,
                                        terminal: left._id.terminal,
                                        fecha: left._id.fecha,
                                        ton: left.ton,
                                        total: left.total
                                    };
                                }).toArray();

                            res.status(200).send({status: 'OK', data : mp});
                        });
                    }
                });
            }
        });
    }

    function getRatesByContainer(req, res) {
        var usr = req.usr,
            paramTerminal = req.params.terminal,
            moment = require('moment'),
            today = moment(moment().format('YYYY-MM-DD')).toDate(),
            tomorrow = moment(moment().format('YYYY-MM-DD')).add('days', 1).toDate(),
            ter,
            _price,
            _rates,
            sum = {},
            jsonParam;

        if (req.query.fecha !== undefined) {
            today = moment(moment(req.query.fecha).format('YYYY-MM-DD')).toDate();
            tomorrow = moment(moment(req.query.fecha).format('YYYY-MM-DD')).add('days', 1).toDate();
        }

        ter = (usr.role === 'agp') ? paramTerminal : usr.terminal;

        _price = require('../include/price.js');
        _rates = new _price.price();
        _rates.rates(function (err, rates) {

            if (req.params.currency === 'PES') {
                sum = { $cond: [
                    {$eq: ['$codMoneda', 'PES' ]},
                    '$detalle.items.impTot',
                    {$multiply: ['$detalle.items.impTot', '$cotiMoneda'] }
                ]};
            } else if (req.params.currency === 'DOL') {
                sum = { $cond: [
                    {$eq: ['$codMoneda', 'DOL' ]},
                    '$detalle.items.impTot',
                    {$divide: ['$detalle.items.impTot', '$cotiMoneda'] }
                ]};
            }

            jsonParam = [
                {   $match: {
                    terminal: ter,
                    'detalle.items.id' : {$in: rates},
                    'detalle.contenedor' : req.params.container
                }},
                {$unwind : '$detalle'},
                {$unwind : '$detalle.items'},
                {$match : {
                    'detalle.items.id' : {$in: rates},
                    'detalle.contenedor' : req.params.container
                }},
                {$project : {terminal: 1, 'detalle.items': 1, total : sum }},
                {
                    $group  : {
                        _id: {
                            terminal: '$terminal',
                            id: '$detalle.items.id'
                        },
                        cnt: { $sum: '$detalle.items.cnt'},
                        total: {$sum: '$total'}
                    }
                }
            ];
            Invoice.aggregate(jsonParam, function (err, data) {
                if (err) {
                    res.status(500).send({status: 'ERROR', data: err.message });
                } else {
                    res.status(200).send({status: 'OK', data: data });
                }
            });
        });
    }

    function getNoMatches(req, res) {

        var paramTerminal = req.params.terminal,
            skip = parseInt(req.params.skip, 10),
            limit = parseInt(req.params.limit, 10),
            param = [
                {
                    $match: {terminal: paramTerminal }
                },
                {$unwind: '$match'},
                {$project: {match: '$match', _id: 0}}
            ],
            s,
            parametro,
            fecha,
            match = {
                terminal: paramTerminal
            },
            inv;

        s = MatchPrice.aggregate(param);
        s.exec(function (err, noMatches) {
            if (!err) {
                var arrResult = [];
                noMatches.forEach(function (item) {
                    arrResult.push(item.match);
                });

                if (req.query.fechaInicio || req.query.fechaFin) {
                    match["fecha.emision"] = {};
                    if (req.query.fechaInicio) {
                        fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD HH:mm Z')).toDate();
                        match["fecha.emision"]['$gte'] = fecha;
                    }
                    if (req.query.fechaFin) {
                        fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD HH:mm Z')).toDate();
                        match["fecha.emision"]['$lte'] = fecha;
                    }
                }

                parametro = [
                    { $match: match},
                    { $unwind: "$detalle"},
                    { $unwind: "$detalle.items"},
                    { $project: { code: '$detalle.items.id'}},
                    { $match: {code: {$nin: arrResult}}},
                    { $group: {_id: { _id: "$_id"}}},
                    { $skip : skip},
                    { $limit : limit}
                ];

                inv = Invoice.aggregate(parametro);

                inv.exec(function (err, data) {
                    var ids = [];
                    data.forEach(function (item) {
                        ids.push(item._id._id);
                    });
                    if (!err) {
                        if (data.length > 0) {
                            inv._pipeline.splice(6, 2);
                            inv.group({_id: null, cnt: {$sum: 1}});
                            inv.exec(function (err, data2) {

                                Invoice.find({_id : {$in: ids}}, function (err, invoices){
                                    var cnt = data2[0].cnt,
                                        pageCount = data.length,
                                        result = {
                                            status: 'OK',
                                            totalCount: cnt,
                                            pageCount: (limit > pageCount) ? limit : pageCount,
                                            page: skip,
                                            data: invoices
                                        };
                                    res.status(200).send(result);
                                });

                            });
                        } else {
                            res.status(200).send({ status: 'OK', data: null });
                        }
                    }
                });
            } else {
                log.logger.error('%s', err);
                res.status(500).send({status: 'ERROR', data: err.message});
            }
        });
    }

    function getCorrelative(req, res) {
        var usr = req.usr,
            fecha,
            param = {},
            cashBoxes,
            cashboxExecs,
            contadorFaltantesTotal,
            order;

        if (usr.role === 'agp') {
            param.terminal = req.params.terminal;
        } else {
            param.terminal = usr.terminal;
        }

        if (req.query.fechaInicio || req.query.fechaFin){
            param["fecha.emision"] = {};
            if (req.query.fechaInicio) {
                fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD HH:mm Z'));
                param["fecha.emision"]['$gte'] = fecha;
            }
            if (req.query.fechaFin) {
                fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD HH:mm Z'));
                param["fecha.emision"]['$lte'] = fecha;
            }
        }
        cashBoxes = [];
        if (req.query.nroPtoVenta) {
            cashBoxes = req.query.nroPtoVenta.split(',');
        } else {
            log.logger.error("El nro de punto de venta no ha sido enviado");
            res.status(403).send({status: "ERROR", data: "El nro de punto de venta no ha sido enviado" });
        }
        if (req.query.codTipoComprob) {
            param.codTipoComprob = parseInt(req.query.codTipoComprob, 10);
        }

        cashboxExecs = [];
        contadorFaltantesTotal = 0;

        cashBoxes.forEach(function (cash) {
            //funcion que calcula la correlatividad por cada caja que sera ejecutada en paralelo con async
            var cashboxExec = function (callback) {
                param.nroPtoVenta = cash;
                var invoices = Invoice.find(param, {nroComprob: 1, _id: 0});

                if (req.query.order) {
                    order = JSON.parse(req.query.order);
                    invoices.sort(order[0]);
                } else {
                    invoices.sort({nroComprob: 1});
                }
                invoices.exec(function (err, invoices) {
                    var faltantes = [],
                        control = 0,
                        contadorFaltantes = 0,
                        result;

                    if (!err) {
                        invoices.forEach(function (invoice) {
                            if (control === 0) {
                                control = invoice.nroComprob;
                            } else {
                                control += 1;
                                if (control !== invoice.nroComprob) {
                                    if (invoice.nroComprob - control > 3) {
                                        var dif = (invoice.nroComprob) - control;
                                        contadorFaltantes+= dif;
                                        var item2Add = util.format('[%d a %d] (%d)', control, (invoice.nroComprob - 1), dif);
                                        faltantes.push(item2Add);
                                    } else {
                                        for (var i=control, len=invoice.nroComprob ; i<len; i++){
                                            faltantes.push(i.toString());
                                            contadorFaltantes++;
                                        }
                                    }
                                    control = invoice.nroComprob;
                                }
                            }
                        });
                        contadorFaltantesTotal += contadorFaltantes;
                        result = {
                            status: 'OK',
                            nroPtoVenta: cash,
                            totalCount: contadorFaltantes,
                            data: faltantes
                        };
                        //io.sockets.emit('correlative', result);
                        io.sockets.emit('correlative_'+req.query.x, result);
                        return callback(null, result);
                    } else {
                        log.logger.error("%s", err.message);
                        res.status(500).send({status: "ERROR", data: {name: err.name, message: err.message} });
                    }
                });
            };

            cashboxExecs.push(cashboxExec);
        });

        var async = require('async');
        async.parallel(cashboxExecs, function (err, results) {
            var response = {
                status: "OK",
                totalCount: contadorFaltantesTotal,
                data: results
            };
            res.status(200).send(response);
        });

    }

    function getCashbox(req, res){
        var usr = req.usr;
        var paramTerminal = req.params.terminal;

        var fecha;

        var ter = (usr.role === 'agp') ? paramTerminal : usr.terminal;
        var param = {terminal:	ter};

        if (req.query.fechaInicio || req.query.fechaFin){
            param["fecha.emision"]={};
            if (req.query.fechaInicio){
                fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD HH:mm Z'));
                param["fecha.emision"]['$gte'] = fecha;
            }
            if (req.query.fechaFin){
                fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD HH:mm Z'));
                param["fecha.emision"]['$lte'] = fecha;
            }
        }
        if (req.query.nroPtoVenta){
            param.nroPtoVenta = req.query.nroPtoVenta;
        }
        if (req.query.codTipoComprob){
            param.codTipoComprob = req.query.codTipoComprob;
        }
        if (req.query.nroComprobante){
            param.nroComprob = req.query.nroComprobante;
        }
        if (req.query.razonSocial){
            param.razon = {$regex:req.query.razonSocial}
        }
        if (req.query.documentoCliente){
            param.nroDoc = req.query.documentoCliente;
        }

        if (req.query.contenedor)
            param['detalle.contenedor'] = req.query.contenedor;

        if (req.query.buqueNombre)
            param['detalle.buque.nombre'] = req.query.buqueNombre;

        if (req.query.viaje)
            param['detalle.buque.viaje'] = req.query.viaje;

        if (req.query.code)
            param['detalle.items.id'] = req.query.code;

        if (req.query.estado){
            var states = req.query.estado.split(",");
            param['$or'] = [
                { estado:{$size: 1, $elemMatch: {estado: {$in: states}, grupo:'ALL'} } },
                { 'estado.1': { $exists: true } , estado: {$elemMatch: {estado: {$in: states}, grupo: usr.group} } }
            ]
        }

        Invoice.distinct('nroPtoVenta', param, function (err, data){
            if (err){
                res.status(500).send({status: 'ERROR', data: err.message});
            } else {
                res.status(200).send({status: 'OK', data: data.sort()});
            }
        });
    }

    function updateInvoice (req, res) {

        var usr = req.usr;

        var param = {_id: req.params._id, terminal: paramTerminal};
        Invoice.findOneAndUpdate(param, { $set: req.body}, null, function (err, data) {
            if  (err) {
                var errMsg = util.format("%s", err.error);
                log.logger.error(errMsg);
                res.status(500).send({status: "ERROR", data: errMsg});
            } else {
                res.status(200).send({"status": "OK", "data": data})
            }
        });
    }

    function setState (req, res) {
        var usr = req.usr;

        Invoice.update({_id: req.params._id, 'estado.grupo': usr.group},
            {$set: {'estado.$.estado' : req.body.estado}},
            function (err, rowAffected, data){
                if (err) {
                    var errMsg = 'Error en cambio de estado. %s';
                    log.logger.error(errMsg, err.message);
                    res.status(500).send({status:'ERROR', data: 'Error en cambio de estado.'});
                } else  {

                    if (rowAffected === 0){
                        Invoice.findByIdAndUpdate( req.params._id,
                            { $push: { estado: { estado: req.body.estado, grupo: usr.group, user: usr.user } } },
                            {safe: true, upsert: true},
                            function (err, data ){
                                if (err) {
                                    var errMsg = 'Error en cambio de estado. %s';
                                    log.logger.error(errMsg, err.message);
                                    res.status(500).send({status:'ERROR', data: 'Error en cambio de estado.'});
                                } else {
                                    res.status(200).send({status:'OK', data: data});
                                }
                            });
                    } else {
                        res.status(200).send({status:'OK', data: data});
                    }
                }
            });
    }

    function setInvoiced (req, res) {
        var usr = req.usr;

        if (!req.query.nroComprob || !req.query.codTipoComprob || !req.query.terminal) {

        } else {

            Invoice.update({
                    nroComprob: req.query.nroComprob,
                    codTipoComprob: req.query.codTipoComprob,
                    terminal: req.query.terminal
                },
                {$set: {'invoiced': req.query.invoiced}},
                function (err, rowAffected, data) {
                    if (err) {
                        var errMsg = 'Error en cambio de estado. %s';
                        log.logger.error(errMsg, err.message);
                        res.status(500).send({status: 'ERROR', data: 'Error en cambio de estado.'});
                    } else {

                        if (rowAffected === 0) {
                            Invoice.findByIdAndUpdate(req.params._id,
                                {$push: {estado: {estado: req.body.estado, grupo: usr.group, user: usr.user}}},
                                {safe: true, upsert: true},
                                function (err, data) {
                                    if (err) {
                                        var errMsg = 'Error en cambio de estado. %s';
                                        log.logger.error(errMsg, err.message);
                                        res.status(500).send({status: 'ERROR', data: 'Error en cambio de estado.'});
                                    } else {
                                        res.status(200).send({status: 'OK', data: data});
                                    }
                                });
                        } else {
                            res.status(200).send({status: 'OK', data: data});
                        }
                    }
                }
            );
        }
    }

    function removeInvoices ( req, res){

        Invoice.remove({_id: req.params._id}, function (err){
            if (!err){
                log.logger.info('Invoice Removed %s', req.params._id);
                res.status(200).send({status:'OK', data: "OK"});
            } else {
                res.status(500).send({status:'ERROR', data: "Error al intentar eliminar"});
            }
        });
    }

    function getInvoicesByRates (req, res) {

        var ratesParam = req.body.data;
        if (ratesParam.length<1){

        } else {

            var dateIni = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD')).toDate();
            var dateFin = moment(moment(req.query.fechaFin).format('YYYY-MM-DD')).toDate();

            var param = [
                { $match: { code: {$in: ratesParam } } },
                { $unwind: '$match'},
                { $project : {code: '$code',  match: '$match', _id: false}}
            ];
            MatchPrice.aggregate(param, function (err, matchprices) {
                var ids =[];
                matchprices.forEach(function (item){
                    ids.push(item.match);
                });

                param = [
                    {
                        $match : { 'fecha.emision': { $gte: dateIni, $lte: dateFin }  }
                    },
                    {
                        $unwind : '$detalle'
                    },
                    {
                        $unwind : '$detalle.items'
                    },
                    {
                        $match : {
                            'detalle.items.id' : {$in: ids }
                        }
                    },
                    {
                        $group  : {
                            _id: { terminal: '$terminal', code: '$detalle.items.id'},
                            total: { $sum : '$detalle.items.impTot'}
                        }
                    },
                    {
                        $project : { _id:0, terminal: '$_id.terminal', code: '$_id.code', total:1}
                    }
                ];

                var rates = Invoice.aggregate(param);
                rates.exec( function (err, ratesData){
                    if (err){
                        log.logger.error(err);
                        res.status(500).json({status:"ERROR", data: err.message});
                    }
                    else {
                        var response = Enumerable.from(ratesData)
                            .join(Enumerable.from(matchprices), '$.code', '$.match', function (rate, matchprice){
                                rate.code = matchprice.code;
                                return rate;
                            }).toArray();
                        var result = Enumerable.from(response).groupBy("{code: $.code, terminal: $.terminal}", null,
                            function (key, g) {
                                var result = {
                                    terminal: key.terminal
                                };
                                result[key.code] = g.sum("$.total");
                                return result;
                            }).toArray();

                        var result2 = Enumerable.from(result).groupBy("$.terminal" , null,
                            function (key, g) {
                                var prop = g.getSource();
                                var ter = {terminal: key, data: {}};
                                prop.forEach(function (item){
                                    for (var pro in item){
                                        if (pro !== 'terminal')
                                            ter.data[pro]= item[pro];
                                    }
                                });
                                return (ter);
                            }).toArray();
                        res.status(200).json({status:'OK', data: result2});
                    }
                });
            });
        }

    }

    function getDistincts( req, res) {
        var usr = req.usr,
            distinct = '',
            param = {};

        if (req.route.path === '/:terminal/ships') {
            distinct = 'detalle.buque.nombre';
        }

        if (req.route.path === '/:terminal/clients') {
            distinct = 'razon';
        }

        if (usr.role === 'agp') {
            param.terminal = req.params.terminal;
        } else {
            param.terminal = usr.terminal;
        }

        if (distinct !== '') {
            Invoice.distinct(distinct, param, function (err, data) {
                if (err) {
                    res.status(500).send({status: 'ERROR', data: err.message});
                } else {
                    res.status(200)
                        .send({
                            status: 'OK',
                            totalCount: data.length,
                            data: data.sort()
                        });
                }
            });
        } else {
            res.status(400).send({status: 'ERROR', message: 'El ruta es inválida', data: []});
        }
    }

    function getShipTrips (req, res) {
        var usr = req.usr;
        var paramTerminal = req.params.terminal;

        var ter = (usr.role === 'agp')?paramTerminal:usr.terminal;
        var param = {terminal:	ter, 'detalle.buque.nombre':{$ne:null}};

        Invoice.aggregate([
            { $match: param },
            { $unwind : '$detalle'},
            { $group: {_id: {buque: '$detalle.buque.nombre', viaje: '$detalle.buque.viaje', fecha: '$detalle.buque.fecha'} } },
            { $sort: { '_id.buque': 1, '_id.viaje': 1} },
            { $project : {buque: '$_id.buque', viaje: '$_id.viaje', fecha: '$_id.fecha', _id:false}}
        ], function (err, data){
            var Enumerable,
                resultTer;
            if (err) {
                res.status(500).json({status: 'ERROR', data: err.message});
            } else {
                Enumerable = require('linq');
                resultTer = Enumerable.from(data)
                    .groupBy("$.buque" , null,
                    function (key, g) {
                        var prop = g.getSource();
                        var ter = {buque: key, viajes: []};
                        prop.forEach(function (item){
                            var viaje = {
                                viaje : item.viaje,
                                fecha : item.fecha
                            }
                            ter.viajes.push(viaje);
//								for (var pro in item){
//									if (pro !== 'buque')
//										ter.viajes.push(item[pro]);
//								}
                        });
                        return (ter);
                    }).toArray();

                pool.getConnection(function(err, connection) {
                    var strSql;
                    if (err) {
                        console.log(err, "Error acquiring from pool, but returns data from mongo.");
                        res.status(200).send({status: 'OK', data: resultTer});
                    } else {

                        strSql = "select nombrebuque buque, fechaarribo fecha, count(*) cnt " +
                            "	from registro1_sumimpomani " +
                            "	group by nombrebuque, fechaarribo " +
                            "	order by nombrebuque,fechaarribo";

                        connection.execute(strSql, [], {outFormat: oracledb.OBJECT},function (err, dataOra){
                            var dataQ;
                            if (err){
                                connection.release(
                                    function (err) {
                                        if (err) {
                                            console.error(err.message);
                                        }
                                    }
                                );
                                res.status(500).send({ status:'ERROR', data: err });
                            } else {
                                connection.release(
                                    function (err) {
                                        if (err) {
                                            console.error(err.message);
                                        }
                                    }
                                );
                                dataOra = Enumerable.from(dataOra).select(function (item){
                                    return { "buque": item.BUQUE, fecha: item.FECHA};
                                }).toArray();
                                dataQ = Enumerable.from(resultTer).groupJoin(dataOra, '$.buque', '$.buque', function (item, g) {
                                    var both = false;
                                    if (g.getSource !==undefined)
                                        both = true;
                                    return {
                                        buque: item.buque,
                                        viajes: item.viajes,
                                        both : both
                                    };
                                }).toArray();

                                res.status(200).send({status: 'OK', data: dataQ});

                            }
                        });
                    }
                });


            }
        });
    }

    function getShipContainers (req, res) {
        var usr = req.usr;
        log.startElapsed();

        var paramTerminal = req.params.terminal;

        var ter = (usr.role === 'agp')?paramTerminal:usr.terminal;
        var param = {terminal:	ter};

        var buque = req.query.buqueNombre;
        var viaje = req.query.viaje;

        var query = [
            { $match: param },
            { $unwind : '$detalle'},
            { $match: {'detalle.buque.nombre': buque, "detalle.buque.viaje" : viaje} },
            { $group: {_id: {buque: '$detalle.buque.nombre', viaje: "$detalle.buque.viaje",contenedor: '$detalle.contenedor'} } },
            { $project: {contenedor: '$_id.contenedor', _id: false}},
            { $sort: {contenedor: 1} }
        ];
        Invoice.aggregate(query , function (err, dataContainers){
            if (err) {
                res.status(500).send({status: 'ERROR', data: err.message});
            } else {
                Gate.find({buque: buque, viaje: viaje}, function (err, dataGates){
                    if (err) {
                        res.status(500).send({status: 'ERROR', data: err.message});
                    } else {
                        var Enumerable = require('linq');

                        var response = Enumerable.from(dataContainers)
                            .groupJoin(dataGates, '$.contenedor', '$.contenedor', function (inner,outer){
                                var result = {
                                    contenedor:'',
                                    gates: []
                                };
                                if (outer.getSource !== undefined)
                                    result.gates =outer.getSource();

                                result.contenedor = inner;
                                return result;
                            }).toArray();

                        res.status(200)
                            .send({
                                status: 'OK',
                                elapsed: log.getElapsed(),
                                data: response});
                    }
                });
            }
        });
    }

    function getContainersNoRates (req, res) {

        var paramTerminal = req.params.terminal,
            _price = require('../include/price.js'),
            _rates = new _price.price(paramTerminal),
            paramTotal,
            Enumerable = require("linq");

        _rates.rates(function (err, rates){

            var param = {
                    terminal : paramTerminal,
                    codTipoComprob : 1
                },
                fecha='';

            if (req.query.razonSocial) {
                param.razon = {$regex:req.query.razonSocial}
            }

            paramTotal = [
                { $match: param },
                { $project : {'detalle.items.id': 1, 'detalle.contenedor': 1, _id: 0}},
                { $unwind: '$detalle' },
                { $unwind: '$detalle.items' },
                { $match : {'detalle.items.id' : {$in: rates }}},
                { $project : {contenedor : '$detalle.contenedor'} }
            ];

            var inv = Invoice.aggregate(paramTotal);
            inv.exec(function (err, data1){
                //Solo filtra fecha de este lado, en el aggregate trae todas las tasas a las cargas de contenedor históricas.
                if (req.query.fechaInicio || req.query.fechaFin) {
                    param["fecha.emision"] = {};
                    if (req.query.fechaInicio) {
                        fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD 00:00:00 Z')).toDate();
                        param["fecha.emision"]['$gte'] = fecha;
                    }
                    if (req.query.fechaFin) {
                        fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD 00:00:00 Z')).toDate();
                        param["fecha.emision"]['$lte'] = fecha;
                    }
                }

                Invoice.distinct('detalle.contenedor', param, function (err, data2){

                    var contes = Enumerable.from(data1).select('$.contenedor');
                    var contDist = Enumerable.from(data2);

                    var dife = contDist.except(contes)
                        .orderBy()
                        .select(function (item){
                            return {contenedor: {contenedor: item}};})
                        .toArray();

                    res.status(200).json({status: 'OK', totalCount: dife.length, data: dife});
                });

            });
        });
    }

    /*
     router.use(function timeLog(req, res, next){
     log.logger.info('Time: %s', Date.now());
     next();
     });
     */

    router.param('terminal', function (req, res, next, terminal) {
        var usr = req.usr;

        if (usr.terminal !== 'AGP' && usr.terminal !== terminal) {
            var errMsg = util.format('%s', 'La terminal recibida por parámetro es inválida para el token.');
            log.logger.error(errMsg);
            res.status(500).send({status: 'ERROR', data: errMsg});
        } else {
            next();
        }
    });

    router.get('/:terminal/:skip/:limit', getInvoices);
    router.get('/invoice/:id', getInvoice);
    router.get('/counts', getCounts);
    router.get('/countsByDate/:currency', getCountByDate);
    router.get('/countsByMonth/:currency', getCountByMonth);
    router.get('/noRates/:terminal/:skip/:limit', getNoRates);
    router.get('/ratesTotal/:currency', getRatesTotal);
    router.get('/rates', getRatesLiquidacion);
    router.get('/rates/:terminal/:container/:currency', getRatesByContainer);
    router.get('/noMatches/:terminal/:skip/:limit', getNoMatches);
    router.get('/correlative/:terminal', getCorrelative);
    router.get('/cashbox/:terminal', getCashbox);
    router.put('/invoice/:terminal/:_id', updateInvoice);
    router.put('/setState/:terminal/:_id', setState);
    router.delete('/:_id', removeInvoices);
    router.get('/:terminal/ships', getDistincts);
    router.get('/:terminal/containers', getDistincts);
    router.get('/:terminal/clients', getDistincts);
    router.get('/:terminal/shipTrips', getShipTrips);
    router.get('/:terminal/shipContainers', getShipContainers);
    router.post('/byRates', getInvoicesByRates);
    router.get('/containersNoRates/:terminal', getContainersNoRates);

//	app.get('/invoices/log/:seconds', function( req, res) {
//		logInvoiceBody = 1;
//		log.logger.info("Loguear invoiceBody en insert Habilitado.")
//
//		setTimeout(function(){
//			log.logger.info("Loguear invoiceBody en insert Deshabilitado.")
//			logInvoiceBody = 0;
//		}, req.params.seconds);
//
//		res.status(200).send();
//	})

    return router;
};