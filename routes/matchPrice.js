/**
 * Created by Diego Reyes on 2/18/14.
 */
module.exports = function (log) {
    'use strict';

    var express = require('express'),
        router = express.Router(),
        MatchPrice = require('../models/matchPrice.js'),
        Invoice = require('../models/invoice.js'),
        util = require('util'),
        Price = require('../models/price.js'),
        moment = require('moment');

    function getMatchPrices(req, res) {
        var usr = req.usr;

        var paramTerminal = req.params.terminal,
            ter = (usr.role === 'agp') ? paramTerminal : usr.terminal,
            param = {
                $or : [
                    {terminal: "AGP"},
                    {terminal: ter}
                ]
            };

        if (req.query.code) {
            param.code = req.query.code;
        }

        if (req.query.onlyRates) {
            if (req.query.onlyRates !== false) {
                param.rate = {$exists: true};
            }
        }

        Price.find(param, {topPrices : {$slice: -1}})
            .populate({path: 'matches', match: {"terminal": paramTerminal}})
            .sort({terminal: 1, code: 1})
            .exec(function (err, prices) {
                if (!err) {
                    res.status(200).send({status: 'OK', data: prices});
                } else {
                    log.logger.error('Error: %s', err.message);
                    res.status(500).send({status: 'ERROR', data: err.message});
                }
            });
    }

    function getMatchPricesPrice (req, res){
        var usr = req.usr,
            paramTerminal = req.params.terminal,
            ter = (usr.role === 'agp') ? paramTerminal : usr.terminal,
            param = {
                $or : [
                    {terminal: "AGP"},
                    {terminal: ter}
                ]
            };

        if (req.query.code) {
            param.code = req.query.code;
        }

        if (req.query.onlyRates) {
            if (req.query.onlyRates !== false) {
                param.rate = {$exists: true};
            }
        }

        Price.find(param, {topPrices: true})
            .exec(function (err, prices) {
                if (!err) {
                    var matchPrices = MatchPrice.aggregate([
                        { $match : param},
                        { $unwind : '$match'},
                        { $project : {price: true, match : true, code : true}}
                    ]);
                    matchPrices.exec(function (err, matches) {
                        var Enumerable = require('linq'),
                            response = [];
                        Enumerable.from(matches)
                            .join(Enumerable.from(prices), '$.price.id', '$._id.id', function (match, price) {
                                response.push({
                                    code: match.match,
                                    topPrices : price.topPrices
                                });
                            }).toArray();
                        res.status(200).send({status: 'OK', data: response});
                    });
                } else {
                    log.logger.error('Error: %s', err.message);
                    res.status(500).send({status: 'ERROR', data: err.message});
                }
            });
    }

    function getMatches(req, res) {
        var usr = req.usr,
            paramTerminal = req.params.terminal,
            paramMatchPrice,
            paramPrice;

        if (paramTerminal.toLowerCase() === 'all') {
            paramMatchPrice = [
                {$unwind: '$match'}
            ];
            paramPrice = {};
        } else {
            paramMatchPrice = [
                {
                    $match: {terminal: paramTerminal }
                },
                { $unwind: '$match' }
            ];
            paramPrice = {$or: [{terminal: "AGP"}, {terminal: paramTerminal }]};
        }

        var s = MatchPrice.aggregate(paramMatchPrice);
        s.exec(function (err, matches) {
            if (!err) {

                Price.find(paramPrice)
                    .exec(function (err, prices) {
                        if (!err) {
                            var result = {},
                                Enumerable = require('linq'),
                                response = Enumerable.from(matches)
                                    .join(Enumerable.from(prices), '$.price.id', '$._id.id', function (match, price) {
                                        if (req.query.type) {
                                            match.description = {
                                                'currency': price.currency,
                                                'price': price.topPrice
                                            };
                                        } else {
                                            match.description = price.description;
                                        }
                                        return match;
                                    }).toArray();
                            response.forEach(function (item) {
                                result[item.match] = item.description;
                            });

                            res.status(200).send({status: 'OK', data: result});

                        } else {
                            log.logger.error('Error: %s', err.message);
                            res.status(200).send({status: 'ERROR', data: err.message});
                        }
                    });

            } else {
                var errMsg = util.format('Error: %s', err.message);
                log.logger.error(errMsg);
                res.status(500).send({status: 'ERROR', data: errMsg});
            }
        });
    }

    function getNoMatches (req, res) {
        var usr = req.usr,
            paramTerminal = req.params.terminal,
            param = [
                {
                    $match: {terminal: paramTerminal }
                },
                { $unwind: '$match' },
                { $project: {match: '$match', _id: 0}}
            ],
            s = MatchPrice.aggregate(param);

        s.exec(function (err, noMatches) {
            if (!err) {
                var arrNoMatches = [];
                noMatches.forEach(function (item) {
                    arrNoMatches.push(item.match);
                });
                var fecha,
                    param = {};
                if (req.query.fechaInicio || req.query.fechaFin) {
                    param["fecha.emision"] = {};
                    if (req.query.fechaInicio) {
                        fecha = moment(moment(req.query.fechaInicio).format('YYYY-MM-DD HH:mm Z')).toDate();
                        param["fecha.emision"]["$gte"] = fecha;
                    }
                    if (req.query.fechaFin) {
                        fecha = moment(moment(req.query.fechaFin).format('YYYY-MM-DD HH:mm Z')).toDate();
                        param["fecha.emision"]['$lte'] = fecha;
                    }
                }
                param.terminal = paramTerminal;
                var parametro = [
                    { $match: param},
                    { $unwind: '$detalle'},
                    { $unwind: '$detalle.items'},
                    { $match: {'detalle.items.id' : {$nin: arrNoMatches } } },
                    { $group: {
                        _id: {
                            code : '$detalle.items.id'
                        }
                    }},
                    {$sort: {'_id.code': 1}}
                ];
                Invoice.aggregate(parametro, function (err, data) {
                    var result = [];
                    data.forEach(function (item) {
                        result.push(item._id.code);
                    });

                    res.status(200)
                        .send({
                            status: 'OK',
                            totalCount: result.length,
                            data: result
                        });
                });
            }
        });
    }

    function addMatchPrice (req, res) {

        var async = require('async'),
            matches = req.body;

        async.forEachSeries(matches, function(match, asyncCallback) {

            Price.findOne({_id: match._idPrice}, function (err, priceItem) {
                if (!err && priceItem) {
                    if (match._id !== undefined && match._id !== null) {
                        MatchPrice.findOne({_id: match._id}, function (err, matchItem) {
                            matchItem.match = match.match;
                            matchItem.save(function (err) {
                                asyncCallback();
                            });
                        });
                    } else {
                        var _matchPrice2Add = {
                            terminal: match.terminal,
                            code: match.code,
                            match: match.match,
                            price: match._idPrice
                        };
                        _matchPrice2Add = new MatchPrice(_matchPrice2Add);
                        _matchPrice2Add.save(function (err, data) {
                            if (priceItem.matches === null) {
                                priceItem.matches = [];
                            }
                            priceItem.matches.push(data._id);
                            priceItem.save();
                            asyncCallback();
                        });
                    }
                }
            });
        }, function (err) {
            res.send({status: "OK", data: {matches: matches.length}});
        });

    }

    /*
    router.use(function timeLog(req, res, next){
        log.logger.info('Time: %s', Date.now());
        next();
    });
    */
    router.get('/:terminal', getMatchPrices);
    router.get('/price/:terminal', getMatchPricesPrice);
    router.get('/matches/:terminal', getMatches);
    router.get('/matches/all', getMatches);
    router.get('/noMatches/:terminal', getNoMatches);
    router.post('/matchprice', addMatchPrice);
    router.put('/matchprice', addMatchPrice);

    return router;

};