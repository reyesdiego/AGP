/**
 * Created by diego on 18/07/17.
 */
"use strict";

var mongoose = require('mongoose');
var Account = require('./models/account.js');
var Invoices = require('./models/invoice.js');
var VouchersType = require('./models/voucherType.js');
var http = require('http');
var mail = require('./include/emailjs');
var config = require('./config/config.js');
var async = require("async");
var asyncTerminals = require("async");
var moment = require('moment');
var Enumerable = require('linq');
var jade = require('jade');

var date = moment().format('DD-MM-YYYY');

var asyncParallel = [];
var terminalsName = ['bactssa', 't4', 'trp'];

var to = ["dreyes@puertobuenosaires.gob.ar", "reclamosuct@puertobuenosaires.gob.ar", "rwohlers@puertobuenosaires.gob.ar", "leonardo.ferreiro@trp.com.ar"];
var to = ["dreyes@puertobuenosaires.gob.ar"];

var sendToClient = false;
var sendMail = config.email;

var host = config.domain;

mongoose.connect(config.mongo.url, config.mongo.options);

VouchersType.find({}, (err, vouchersDesc) => {

    var voucherList = {};

    if (err) {
        console.error("ERROR OBTENIENDO VOUCHERLIST: %s", err);
    } else {
        vouchersDesc.forEach(item => {
            voucherList[item._id] = item.description;
        });

        Account.find({user: {$in: terminalsName}}, {terminal: 1, token: 1, email: 1, full_name: 1})
            .lean()
            .exec((err, terminals) => {
                var functionObject;

                if (err) {
                    console.error("ERROR OBTENIENDO ACCOUNT: %s", err);
                } else {

                    asyncTerminals.eachSeries(terminals, (user, callbackTerminal) => {

                            let toLocal = [];
                            if (sendToClient === true) {
                                toLocal.push(user.email);
                            }
                            to.forEach(item => {toLocal.push(item);});

                            /** CODIGOS NO ASOCIADOS */
                             functionObject = callbackNoAsociados =>  {
                             var optionsget,
                             reqGet;

                             optionsget = {
                             host : host, // here only the domain name (no http/https !)
                             port : 8090,
                             path : '/matchPrices/noMatches/' + user.terminal,
                             method : 'GET',
                             headers : {
                             Connection: 'keep-alive',
                             token: user.token.token}
                             };

                             reqGet = http.request(optionsget, res => {
                             var resData = '';
                             res.on('data', d => {
                             resData += d;
                             });

                             res.on('error', (err) => {
                             console.error('ERROR RESPONSE NO_ASOCIADOS - NO mail a %s. %s', toLocal);
                             callbackNoAsociados(err);
                             });

                             res.on('end', () => {
                             var result = JSON.parse(resData),
                             mailer;
                             if (result.status === 'OK') {
                             if (result.data.length > 0) {
                             mailer = new mail.mail(sendMail);
                             let subject = `${result.data.length.toString()} códigos no asociados al ${date}`;
                             let html = user.terminal + '\n\n' + result.data;
                             mailer.send(toLocal, subject, html, err => {
                             if (err) {
                             console.error('ERROR MAIL NO_ASOCIADOS - NO mail a %s. %s', toLocal, subject);
                             } else {
                             console.log('NO_ASOCIADOS - Mail a %s - %s', toLocal, moment());
                             }
                             return callbackNoAsociados(err, result.data);
                             });
                             } else {
                             console.log('NO_ASOCIADOS NADA - NO Mail a %s - %s - CERO', toLocal, moment());
                             return callbackNoAsociados(undefined, result.data);
                             }
                             } else {
                             console.error('NO_ASOCIADOS - NO Mail a %s - %s, STATUS: %s', toLocal, moment(), result.status);
                             return callbackNoAsociados();
                             }
                             });
                             });

                             reqGet.end(); // ejecuta el request
                             };
                             asyncParallel.push(functionObject);

                            /** CORRELATIVIDAD */
                            Invoices.distinct('codTipoComprob', {terminal: user.terminal}, (err, voucherTypes) => {
                                        if (!err) {
                                            console.log("Tipo Comprobantes %s: %s", user.terminal, voucherTypes);
                                            voucherTypes.forEach( voucher => {
                                                functionObject = callbackCorrelative => {
                                                    var optionsget,
                                                        reqGet;

                                                    optionsget = {
                                                        host: host, // here only the domain name (no http/https !)
                                                        port: 8090,
                                                        path: `/invoices/correlative/${user.terminal}?codTipoComprob=${voucher}&fechaInicio=2014-08-01&fechaFin=2020-01-01`,
                                                        method: 'GET',
                                                        headers: {
                                                            Connection: 'keep-alive',
                                                            token: user.token.token
                                                        }
                                                    };
                                                    reqGet = http.request(optionsget, res => {
                                                        var resData = '';
                                                        res.on('data', d => {
                                                            resData += d;
                                                        });

                                                        res.on('error', (err) => {
                                                            console.error('CORRELATIVE - NO mail a %s. %s', toLocal);
                                                            callbackCorrelative(err);
                                                        });
                                                        res.on('end', () => {
                                                            var result = JSON.parse(resData),
                                                                totalCnt,
                                                                mailer,
                                                                subject;

                                                            if (result.status === 'OK') {
                                                                totalCnt = Enumerable.from(result.data).sum(item => {return item.totalCount;});
                                                                result = Enumerable.from(result.data).where(item => {
                                                                    var response = false;
                                                                    if (item.totalCount > 0) {
                                                                        response = true;
                                                                    }
                                                                    return response;
                                                                }).toArray();
                                                                if (result.length > 0) {
                                                                    jade.renderFile(__dirname + '/public/correlatividadMail.jade', {
                                                                        param: result,
                                                                        voucher: voucherList[voucher.toString()],
                                                                        terminal: user.full_name,
                                                                        moment: moment,
                                                                        totalCount: totalCnt
                                                                    }, function (err, html) {
                                                                        html = {
                                                                            data: html,
                                                                            alternative: true
                                                                        };

                                                                        mailer = new mail.mail(sendMail);
                                                                        subject = `${voucherList[voucher.toString()]}: ${totalCnt.toString()} faltantes al ${date}`;
                                                                        mailer.send(toLocal,
                                                                            subject,
                                                                            html,
                                                                            function (err, dataMail) {
                                                                                if (err) {
                                                                                    console.log('No se envió mail. %s, %s', err.data, JSON.stringify(result));
                                                                                } else {
                                                                                    console.log('Se envió mail a %s - %s [%s], Comprobante: %s', toLocal, moment(), user.terminal, voucher);
                                                                                }
                                                                                return callbackCorrelative(err, result);
                                                                            });
                                                                    });
                                                                } else {
                                                                    return callbackCorrelative(undefined, result.data);
                                                                }
                                                            } else {
                                                                console.error('ERROR: %s, %j', result.status, result.data);
                                                                return callbackCorrelative();
                                                            }
                                                        });
                                                    });
                                                    reqGet.end(); // ejecuta el request
                                                };
                                                asyncParallel.push(functionObject);
                                            });
                                            callbackTerminal();

                                        } else {
                                            console.error("Error en carga de Voucher Types %s", err);
                                            callbackTerminal();
                                        }
                                    });

                        },
                        () => {
                            console.log('--------INICIO %s- Tareas: %s-------', moment().format("DD-MM-YYYY"), asyncParallel.length);
                            async.parallel(asyncParallel, (err, data) => {
                                if (err) {
                                    console.error("ERROR PARALLEL %s", err);
                                }
                                console.log('--------FIN %s---------', moment().format("DD-MM-YYYY"));
                                process.exit(1);
                            });
                        });
                }
            });
    }
});
