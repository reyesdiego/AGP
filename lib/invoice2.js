/**
 * Created by diego on 2/12/16.
 */
'use strict';

var Constantes = require('./constantes.js');

class InvoiceOracle {
    constructor (connection) {
        this.cn = connection;
    }

    add (invoice, io, callback) {
        var self = this;
        var pool = self.cn.pool;
        let strSql,
            param,
            usr,
            tasks = [],
            task,
            taskComment;
        var moment = require('moment');
        var util = require('util');
        var _autoCommit = false;
        var async = require('async');

        if (pool) {
            pool.getConnection (function (err, connection ) {
                if (err) {
                    console.log("%s, Error en Oracle Adding Invoice in OracleDb.", new Date());
                    self.cn.doRelease(connection);
                    if (callback) return callback({status: "ERROR", message: "Error en Oracle addInvoice", data: err});

                } else {
                    usr = invoice.usr;
                    delete invoice.usr;

                    strSql = "insert into INVOICE_HEADER " +
                        "(ID, " +
                        "TERMINAL, " +
                        "COD_TIPO_COMPROB, " +
                        "NRO_PTO_VENTA, " +
                        "NRO_COMPROB, " +
                        "COD_TIPO_AUTORIZ, " +
                        "COD_AUTORIZ, " +
                        "COD_TIPO_DOC, " +
                        "NRO_DOC, " +
                        "CLIENT_ID, " +
                        "RAZON, " +
                        "IMPORTE_GRAVADO, " +
                        "IMPORTE_NO_GRAVADO, " +
                        "IMPORTE_EXENTO, " +
                        "IMPORTE_IVA, " +
                        "IMPORTE_SUBTOTAL, " +
                        "IMPORTE_OTROS_TRIBUTOS, " +
                        "IMPORTE_TOTAL, " +
                        "TOTAL, " +
                        "COD_MONEDA, " +
                        "COTI_MONEDA, " +
                        "OBSERVA, " +
                        "COD_CONCEPTO, " +
                        "FECHA_EMISION, " +
                        "FECHA_VCTO, " +
                        "FECHA_DESDE, " +
                        "FECHA_HASTA, " +
                        "FECHA_VCTO_PAGO, " +
                        "RESEND" +
                        ") VALUES (" +
                        "invoices_seq.nextval, " +
                        ":terminal, " +
                        ":codTipoComprob, " +
                        ":nroPtoVenta, " +
                        ":nroComprob, " +
                        ":codTipoAutoriz, " +
                        ":codAutoriz, " +
                        ":codTipoDoc," +
                        ":nroDoc, " +
                        ":clientId, " +
                        ":razon, " +
                        ":importeGravado, " +
                        ":importeNoGravado, " +
                        ":importeExento, " +
                        ":importeIva, " +
                        ":importeSubtotal, " +
                        ":importeOtrosTributos, " +
                        ":importeTotal, " +
                        ":total, " +
                        ":codMoneda," +
                        ":cotiMoneda," +
                        ":observa, " +
                        ":codConcepto," +
                        "to_date(:fechaEmision, 'YYYY-MM-DD')," +
                        "to_date(:fechaVcto, 'YYYY-MM-DD')," +
                        "to_date(:fechaDesde, 'YYYY-MM-DD')," +
                        "to_date(:fechaHasta, 'YYYY-MM-DD')," +
                        "to_date(:fechaVctoPago, 'YYYY-MM-DD'), " +
                        ":resend " +
                        ") RETURNING ID INTO :outputId";
                    param = {
                        outputId : {type: self.cn.oracledb.NUMBER, dir: self.cn.oracledb.BIND_OUT},
                        terminal: usr.terminal,
                        codTipoComprob: parseInt(invoice.codTipoComprob.toString().trim(), 10),
                        nroPtoVenta: invoice.nroPtoVenta,
                        nroComprob: invoice.nroComprob,
                        codTipoAutoriz: invoice.codTipoAutoriz,
                        codAutoriz: invoice.codAutoriz,
                        codTipoDoc: invoice.codTipoDoc,
                        nroDoc: invoice.nroDoc,
                        clientId: invoice.clientId,
                        razon: invoice.razon.trim(),
                        importeGravado: Math.abs(invoice.impGrav),
                        importeNoGravado: Math.abs(invoice.impNoGrav),
                        importeExento: Math.abs(invoice.impExento),
                        importeIva: Math.abs(invoice.impIva),
                        importeSubtotal: Math.abs(invoice.impSubtot),
                        importeOtrosTributos: invoice.impOtrosTrib,
                        importeTotal: Math.abs(invoice.impTotal),
                        total: invoice.total,
                        codMoneda: invoice.codMoneda,
                        cotiMoneda: invoice.cotiMoneda,
                        observa: invoice.observa,
                        codConcepto: invoice.codConcepto,
                        fechaEmision: moment(invoice.fechaEmision, "YYYY-MM-DD").format("YYYY-MM-DD"),
                        fechaVcto: moment(invoice.fechaVcto, "YYYY-MM-DD").format("YYYY-MM-DD"),
                        fechaDesde: moment(invoice.fechaServDesde, "YYYY-MM-DD").format("YYYY-MM-DD"),
                        fechaHasta: moment(invoice.fechaServHasta, "YYYY-MM-DD").format("YYYY-MM-DD"),
                        fechaVctoPago: moment(invoice.fechaVctoPago, "YYYY-MM-DD").format("YYYY-MM-DD"),
                        resend: invoice.resend
                    };
                    connection.execute(strSql, param, {autoCommit: _autoCommit}, function(err, result) {
                        let error;
                        if (err) {
                            error = self.cn.error(err);
                            error.data = invoice;
                            if (error.code === 'ORA-00001') {
                                strSql = "SELECT RESEND FROM INVOICE_HEADER " +
                                    "WHERE NRO_COMPROB = " + param.nroComprob + " AND " +
                                    "   COD_TIPO_COMPROB = " + param.codTipoComprob + " AND " +
                                    "   TERMINAL = '" + param.terminal + "' AND " +
                                    "   NRO_PTO_VENTA = " + param.nroPtoVenta;
                                connection.execute(strSql, [], {}, function (err, data) {

                                    if (err) {
                                        if (callback) return callback({status: "ERROR", message: "Adding Invoice in OracleDb", data: error});
                                    } else {
                                        if (data.rows[0].RESEND === 1) {
                                            strSql = "DELETE FROM INVOICE_HEADER " +
                                                "WHERE NRO_COMPROB = " + param.nroComprob + " AND " +
                                                "   COD_TIPO_COMPROB = " + param.codTipoComprob + " AND " +
                                                "   TERMINAL = '" + param.terminal + "' AND " +
                                                "   NRO_PTO_VENTA = " + param.nroPtoVenta;
                                            connection.execute(strSql, [], {autoCommit: true}, function (err, result) {
                                                if (err) {
                                                    if (callback) return callback({status: "ERROR", message: "Adding Invoice in OracleDb", data: error});
                                                } else {
                                                    self.add(invoice, io, callback);
                                                }

                                            });
                                        } else {
                                            if (callback) return callback({status: "ERROR", message: error.message, data: error.data});
                                        }
                                    }
                                });
                            } else {
                                if (callback) return callback({status: "ERROR", message: error.message, data: error.data});
                            }
                        } else {
                            let subTotalCheck = 0,
                                estado = 'Y';
                            var comment = 'Comprobante transferido correntamente.';
                            var commentState = 'Y';

                            param._id = result.outBinds.outputId[0];

                            invoice.detalle.forEach(function (detalle) {
                                detalle.items.forEach(function (item) {
                                    subTotalCheck += Math.abs(item.impTot);

                                    task = function (callbackDetail) {
                                        let param;
                                        strSql = "insert into INVOICE_DETAIL " +
                                            "(ID," +
                                            "INVOICE_HEADER_ID," +
                                            "CONTENEDOR," +
                                            "IMO," +
                                            "BUQUE_CODIGO," +
                                            "BUQUE_NOMBRE," +
                                            "BUQUE_VIAJE," +
                                            "BUQUE_FECHA," +
                                            "CODE," +
                                            "CNT," +
                                            "UNI_MED," +
                                            "IMP_UNIT," +
                                            "IMP_TOT" +
                                            ") VALUES (" +
                                            "invoices_seq.nextval," +
                                            ":INVOICE_HEADER_ID, " +
                                            ":CONTENEDOR, " +
                                            ":IMO, " +
                                            ":BUQUE_CODIGO, " +
                                            ":BUQUE_NOMBRE, " +
                                            ":VIAJE, " +
                                            ":FECHA," +
                                            ":CODE, " +
                                            ":IMPUNIT, " +
                                            ":UNIMED," +
                                            ":CNT, " +
                                            ":IMPTOT)";

                                        let buqueId = (detalle.buqueId !== undefined && detalle.buqueId !== null) ? detalle.buqueId.toString() : "";
                                        let buqueDesc = detalle.buqueDesc;
                                        let viaje = detalle.viaje;
                                        let fecha = (detalle.fecha !== undefined && detalle.fecha !== "" && detalle.fecha != null) ? moment(detalle.fecha, "YYYY-MM-DD") : "";

                                        param = {
                                            INVOICE_HEADER_ID: result.outBinds.outputId[0],
                                            CONTENEDOR: (detalle.contenedor) ? detalle.contenedor.trim() : "",
                                            IMO: (detalle.IMO !== undefined) ? detalle.IMO : 0,
                                            BUQUE_CODIGO: buqueId,
                                            BUQUE_NOMBRE: buqueDesc,
                                            VIAJE: viaje,
                                            FECHA: fecha,
                                            CODE: item.id,
                                            IMPUNIT: item.impUnit,
                                            IMPTOT: Math.abs(item.impTot),
                                            UNIMED: item.uniMed,
                                            CNT: Math.abs(item.cnt)
                                        };
                                        connection.execute(strSql, param, {autoCommit: _autoCommit}, function(err, resultDetail) {
                                            if (err) {
                                                callbackDetail(self.cn.error(err));
                                            } else {
                                                callbackDetail(undefined, resultDetail);
                                            }
                                        });
                                    };
                                    tasks.push(task);
                                });
                            });

                            if ((subTotalCheck > invoice.impSubtot + 2) || (subTotalCheck < invoice.impSubtot - 2)) {
                                comment = util.format("El subtotal del comprobante es incorrecto, la suma es %d y se informa %d. - %s.", subTotalCheck, invoice.impSubtot, usr.terminal);
                                estado = 'T';
                            }

                            taskComment = function (callbackComment) {
                                let param;
                                strSql = "insert into INVOICE_COMMENT " +
                                    "(ID," +
                                    "INVOICE_HEADER_ID," +
                                    "TITLE," +
                                    "COMENTARIO," +
                                    "USR," +
                                    "STATE," +
                                    "GRUPO ) VALUES (" +
                                    "invoices_seq.nextval, " +
                                    ":INVOICE_HEADER_ID," +
                                    ":TITLE, " +
                                    ":COMENTARIO," +
                                    ":USR," +
                                    ":STATE," +
                                    ":GRUPO )";
                                param = {
                                    INVOICE_HEADER_ID :result.outBinds.outputId[0],
                                    TITLE: 'Transferencia comprobante.',
                                    COMENTARIO: comment,
                                    USR: usr.user,
                                    STATE: commentState,
                                    GRUPO: "ALL"
                                };
                                connection.execute(strSql, param, {autoCommit: _autoCommit}, function(err, resultComment) {
                                    if (err) {
                                        callbackComment(self.cn.error(err));
                                    } else {
                                        callbackComment(undefined, resultComment);
                                    }
                                });
                            };
                            tasks.push(taskComment);

                            task = function (callbackState) {
                                let param;
                                strSql = "insert into INVOICE_STATE " +
                                    "(ID," +
                                    "INVOICE_HEADER_ID," +
                                    "USR," +
                                    "GRUPO," +
                                    "STATE ) VALUES (" +
                                    "invoices_seq.nextval, " +
                                    ":INVOICE_HEADER_ID," +
                                    ":USR," +
                                    ":GRUPO," +
                                    ":STATE )";
                                param = {
                                    INVOICE_HEADER_ID :result.outBinds.outputId[0],
                                    USR: usr.user,
                                    STATE: estado,
                                    GRUPO: "ALL"
                                };
                                connection.execute(strSql, param, {autoCommit: _autoCommit}, function(err, resultState) {
                                    if (err) {
                                        callbackState(self.cn.error(err));
                                    } else {
                                        callbackState(undefined, resultState);
                                    }
                                });
                            };
                            tasks.push(task);

                            async.parallel(tasks, function (err, data) {
                                if (err) {
                                    connection.rollback(function(err) {
                                        self.cn.doRelease(connection);
                                        if (callback) return callback({
                                            status: "ERROR",
                                            data: self.cn.error(err)
                                        });
                                    });
                                } else {
                                    connection.commit(function(err) {
                                        self.cn.doRelease(connection);
                                        if (err) {
                                            if (callback) return callback({
                                                status: "ERROR",
                                                data: self.cn.error(err)
                                            });
                                        } else {
                                            if (callback) return callback(undefined, {
                                                status: "OK", data: param
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

    }

    getInvoice (params, callback) {
        var self = this;
        var pool = self.cn.pool;
        var strSql,
            strWhere,
            result;
        var tasksAsync = [],
            taskAsync,
            async = require('async');

        if (pool) {
            taskAsync = function (asyncCallback) {
               pool.getConnection(function (err, connection) {
                   if (err) {
                       console.log("%s, Error en Oracle getInvoice.", new Date());
                       self.cn.doRelease(connection);
                       if (callback) return callback({status: "ERROR", message: "Error en Oracle getInvoice", data: err});
                   } else {

                       strSql = "SELECT ID, " +
                           "TERMINAL, " +
                           "COD_TIPO_COMPROB, " +
                           "NRO_PTO_VENTA, " +
                           "NRO_COMPROB, " +
                           "COD_TIPO_AUTORIZ, " +
                           "COD_AUTORIZ, " +
                           "COD_TIPO_DOC, " +
                           "NRO_DOC, " +
                           "CLIENT_ID, " +
                           "RAZON, " +
                           "IMPORTE_GRAVADO, " +
                           "IMPORTE_NO_GRAVADO, " +
                           "IMPORTE_EXENTO, " +
                           "IMPORTE_IVA, " +
                           "IMPORTE_SUBTOTAL, " +
                           "IMPORTE_OTROS_TRIBUTOS, " +
                           "IMPORTE_TOTAL, " +
                           "TOTAL, " +
                           "COD_MONEDA, " +
                           "COTI_MONEDA, " +
                           "OBSERVA, " +
                           "COD_CONCEPTO, " +
                           "FECHA_EMISION, " +
                           "FECHA_VCTO, " +
                           "FECHA_DESDE, " +
                           "FECHA_HASTA, " +
                           "FECHA_VCTO_PAGO, " +
                           "RESEND " +
                           "FROM INVOICE_HEADER " +
                           " WHERE ID = :1";
                       connection.execute(strSql, [params._id], {}, function (err, data) {
                           self.cn.doRelease(connection);
                           if (err) {
                               return asyncCallback(err);
                           } else {
                               if (data.rows) {
                                   data = data.rows.map(function (item) {
                                       return {
                                           _id: item.ID,
                                           terminal: item.TERMINAL,
                                           codTipoComprob: item.COD_TIPO_COMPROB,
                                           nroPtoVenta: item.NRO_PTO_VENTA,
                                           nroComprob: item.NRO_COMPROB,
                                           codTipoAutoriz: item.COD_TIPO_AUTORIZ,
                                           codAutoriz: item.COD_AUTORIZ,
                                           codTipoDoc: item.COD_TIPO_DOC,
                                           nroDoc: item.NRO_DOC,
                                           client_id: item.client_id,
                                           razon: item.RAZON,
                                           importe: {
                                               gravado: item.IMPORTE_GRAVADO,
                                               noGravado: item.IMPORTE_NO_GRAVADO,
                                               exento: item.IMPORTE_EXENTO,
                                               subtotal: item.IMPORTE_SUBTOTAL,
                                               iva: item.IMPORTE_IVA,
                                               importe_otros_tributos: item.IMPORTE_OTROS_TRIBUTOS,
                                               total: item.IMPORTE_TOTAL
                                           },
                                           total: item.TOTAL,
                                           codMoneda: item.COD_MONEDA,
                                           cotiMoneda: item.COTI_MONEDA,
                                           observa: item.OBSERVA,
                                           codConcepto: item.COD_CONCEPTO,
                                           fecha: {
                                               emision: item.FECHA_EMISION,
                                               vcto: item.FECHA_VCTO,
                                               desde: item.FECHA_DESDE,
                                               hasta: item.FECHA_HASTA,
                                               vctoPago: item.FECHA_VCTO_PAGO
                                           },
                                           comments: [],
                                           estado: [
                                               {
                                                   "grupo": "ALL",
                                                   "user": "t4",
                                                   "_id": "56c5a1dbb5163b4d5f00b027",
                                                   "estado": "Y"
                                               }
                                           ],
                                           otrosTributos: []
                                       };
                                   });
                               }
                               return asyncCallback(undefined, data);
                           }
                       });
                   }
               });
           };
            tasksAsync.push(taskAsync);
            taskAsync = function (asyncCallback) {
                pool.getConnection(function (err, connection) {
                    if (err) {
                        console.log("%s, Error en Oracle getInvoice.", new Date());
                        self.cn.doRelease(connection);
                        if (callback) return callback({status: "ERROR", message: "Error en Oracle getInvoice", data: err});
                    } else {

                        strSql = "SELECT ID, " +
                            "INVOICE_HEADER_ID, " +
                            "CONTENEDOR, " +
                            "IMO, " +
                            "BUQUE_CODIGO, " +
                            "BUQUE_NOMBRE, " +
                            "BUQUE_VIAJE, " +
                            "BUQUE_FECHA, " +
                            "CODE, " +
                            "CNT, " +
                            "UNI_MED, " +
                            "IMP_UNIT, " +
                            "IMP_TOT " +
                            "FROM INVOICE_DETAIL " +
                            " WHERE INVOICE_HEADER_ID = :1";
                        connection.execute(strSql, [params._id], {}, function (err, data) {
                            self.cn.doRelease(connection);
                            if (err) {
                                return asyncCallback(err);
                            } else {
                                if (data.rows) {
                                    data = data.rows.map(function (item) {
                                        return {
                                            id: item.CODE,
                                            contenedor: item.CONTENEDOR,
                                            imo: item.IMO,
                                            cnt: item.CNT,
                                            uniMed: item.UNI_MED,
                                            impUnit: item.IMP_UNIT,
                                            impTot: item.IMP_TOT

                                            //"buque" : {
                                            //    "codigo" : "1CM",
                                            //    "nombre" : "MAERSK LANCO",
                                            //    "viaje" : "1602",
                                            //    "fecha" : "2016-02-21T00:00:00.000-03:00"
                                            //}
                                        };
                                    });
                                }
                                return asyncCallback(undefined, data);
                            }
                        });
                    }
                });
            };
            tasksAsync.push(taskAsync);

            async.parallel(tasksAsync, function (err, data) {
                var header = data[0];
                var details = data[1];
                var result = {};
                console.log("DETAIL %j", data[1]);

                header.detalle = data[1];

                result = {
                    status: 'OK',
                    data: header
                };
                if (callback) return callback( err, result);
            });
        }
    }

    getInvoices (params, callback) {
        var self = this;
        var pool = self.cn.pool;
        var async = require('async');
        var util = require('util');
        var moment = require('moment');
        var tasksAsync = [],
            taskAsync;
        var strSql,
            strWhere = '',
            strWhereExists = '',
            result;
        var skip,
            limit,
            orderBy = ' ID ';

        skip = parseInt(params.skip);
        limit = parseInt(params.limit);
//            tipoResultado = oracle.oracledb.ARRAY;

        if (params.order) {
            orderBy = this.cn.orderBy(params.order);
        }

        if (pool) {

            if (params.terminal) {
                strWhere += util.format(" TERMINAL = '%s' AND ", params.terminal);
            }
            if (params.fechaInicio) {
                strWhere += util.format(" FECHA_EMISION >= TO_DATE('%s', 'RRRR-MM-DD') AND ", moment(params.fechaInicio, 'YYYY-MM-DD').format('YYYY-MM-DD'));
            }
            if (params.fechaFin) {
                strWhere += util.format(" FECHA_EMISION <= TO_DATE('%s', 'RRRR-MM-DD') AND ", moment(params.fechaFin, 'YYYY-MM-DD').format('YYYY-MM-DD'));
            }
            if (params.nroPtoVenta) {
                strWhere += util.format(" NRO_PTO_VENTA = %s AND ", params.nroPtoVenta);
            }
            if (params.codTipoComprob) {
                strWhere += util.format(" COD_TIPO_COMPROB = %s AND ", params.codTipoComprob);
            }
            if (params.nroComprobante) {
                strWhere += util.format(" NRO_COMPROB = %s AND ", params.nroComprobante);
            }
            if (params.razonSocial) {
                strWhere += util.format(" RAZON = '%s' AND ", params.razonSocial);
            }
            if (params.documentoCliente) {
                strWhere += util.format(" NRO_DOC = %s AND ", params.documentoCliente);
            }
            if (params.resend) {
                strWhere += util.format(" RESEND = %s AND ", params.resend);
            }
            //DETAIL
            if (params.contenedor) {
                strWhereExists += util.format(" CONTENEDOR = '%s' AND ", params.contenedor);
            }
            if (params.buqueNombre) {
                strWhereExists += util.format(" BUQUE_NOMBRE = '%s' AND ", params.buqueNombre);
            }
            if (params.viaje) {
                strWhereExists += util.format(" BUQUE_VIAJE = '%s' AND ", params.buqueViaje);
            }
            if (params.code) {
                strWhereExists += util.format(" CODE = '%s' AND ", params.code);
            }
            if (strWhereExists.length > 0) {
                strWhereExists = util.format('( SELECT * FROM INVOICE_DETAIL WHERE INVOICE_HEADER.ID = INVOICE_HEADER_ID AND %s )', strWhereExists.substr(0, strWhereExists.length - 4));
                strWhere += util.format(" EXISTS %s AND ", strWhereExists);
            }

            if (strWhere.length > 0) {
                strWhere = util.format(" WHERE %s ", strWhere.substr(0, strWhere.length - 4));
            }
            pool.getConnection(function (err, connection) {
                if (err) {
                    console.log("%s, Error en Oracle getInvoices.", new Date());
                    self.cn.doRelease(connection);
                } else {

                    taskAsync = function (asyncCallback) {
                        strSql = "SELECT * FROM " +
                            "(SELECT " +
                            "   ID, " +
                            "   TERMINAL, " +
                            "   COD_TIPO_COMPROB, " +
                            "   NRO_PTO_VENTA, " +
                            "   RAZON, " +
                            "   FECHA_EMISION, " +
                            "   NRO_COMPROB, " +
                            "   IMPORTE_TOTAL, " +
                            "   ROW_NUMBER() OVER (ORDER BY " + orderBy + ") R " +
                            "FROM INVOICE_HEADER %s) " +
                            "WHERE R BETWEEN :1 and :2";

                        strSql = util.format(strSql, strWhere);

                        connection.execute(strSql, [skip, skip + limit], {}, function (err, data) {
                            if (err) {
                                asyncCallback(err);
                            } else {
                                if (data.rows) {
                                    result = {
                                        status: "OK"
                                    };
                                    result.data = data.rows.map(function (item) {
                                        return {
                                            _id: item.ID,
                                            terminal: item.TERMINAL,
                                            codTipoComprob: item.COD_TIPO_COMPROB,
                                            nroComprob: item.NRO_COMPROB,
                                            razon: item.RAZON,
                                            importe: {total: item.IMPORTE_TOTAL},
                                            fecha: {emision: item.FECHA_EMISION},
                                            nroPtoVenta: item.NRO_PTO_VENTA
                                        };
                                    });
                                }
                                asyncCallback(undefined, result);
                            }
                        });
                    };
                    tasksAsync.push(taskAsync);

                    taskAsync = function (asyncCallback) {
                        strSql = "SELECT count(*) TOTAL " +
                            "FROM INVOICE_HEADER %s";

                        strSql = util.format(strSql, strWhere);

                        connection.execute(strSql, [], {}, function (err, data) {
                            if (err) {
                                asyncCallback(err);
                            } else {
                                let total = 0;
                                if (data.rows) {
                                    total = data.rows[0].TOTAL;
                                }
                                asyncCallback(undefined, total);
                            }
                        });
                    };
                    tasksAsync.push(taskAsync);
                }
                async.parallel(tasksAsync, function (err, data) {
                    var result = data[0];

                    self.cn.doRelease(connection);

                    if (data[1]) {
                        result.totalCount = data[1];
                    }
                    callback(err, result);
                });
            });
        }
    }

    getCounts (params, callback) {
        var self = this;
        var pool = self.cn.pool;
        var strSql,
            fechaEmision,
            util = require('util'),
            moment = require('moment'),
            Enumerable = require('linq'),
            response;

        if (pool) {
            pool.getConnection (function (err, connection) {
                if (err) {
                    console.log("%s, Error en Oracle getCounts.", new Date());
                    self.cn.doRelease(connection);
                } else {

                    fechaEmision = moment().format('YYYY-MM-DD');

                    if (params.fecha !== undefined) {
                        fechaEmision = moment(params.fecha, ['YYYY-MM-DD']).format('YYYY-MM-DD');
                    }

                    strSql = "SELECT terminal,cod_Tipo_Comprob, sum(total) as total, count(*) as cnt " +
                        " FROM INVOICE_HEADER " +
                        " WHERE FECHA_EMISION = TO_DATE(:1,'YYYY-MM-DD') " +
                        "GROUP BY terminal,cod_Tipo_Comprob ";


                    connection.execute(strSql, [fechaEmision], {}, function (err, data) {
                        if (err) {
                            callback({status: "ERROR", message: err.message, data: err});
                        } else {

                            response = Enumerable.from(data.rows)
                                .groupBy('$.COD_TIPO_COMPROB',
                                function (item) {
                                    return item;
                                },
                                function (job, grouping) {
                                    var grupo = grouping.getSource(),
                                        cnt = grouping.sum(function (item) {
                                            return item.CNT;
                                        }),
                                        tot = grouping.sum(function (item) {
                                            return item.TOTAL;
                                        }),
                                        grupoItem = {
                                            codTipoComprob: job,
                                            cnt: cnt,
                                            total: tot
                                        };

                                    grupo.forEach(function (item) {
                                        var porcenCnt = item.CNT * 100 / cnt,
                                            porcenTotal = item.TOTAL * 100 / tot;

                                        grupoItem[item.TERMINAL] = {
                                            cnt: [item.CNT, porcenCnt],
                                            total: [item.TOTAL, porcenTotal]
                                        };
                                    });

                                    return grupoItem;
                                }).toArray();

                            callback(undefined, {
                                status: "OK",
                                data: response
                            });
                        }
                    });
                }
            });
        }
    }

    getCountByDate (params, callback) {
        var self = this;
        var pool = self.cn.pool;
        var strSql,
            fechaEmision,
            date5Ago,
            tomorrow,
            util = require('util'),
            moment = require('moment'),
            response;

        if (pool) {
            pool.getConnection (function (err, connection) {
                if (err) {
                    console.log("%s, Error en Oracle getCountByDate.", new Date());
                    self.cn.doRelease(connection);
                } else {

                    fechaEmision = moment().format('YYYY-MM-DD');

                    if (params.fecha !== undefined) {
                        fechaEmision = moment(params.fecha, ['YYYY-MM-DD']).format('YYYY-MM-DD');
                    }
                    date5Ago = moment(fechaEmision).subtract(4, 'days').format('YYYY-MM-DD');
                    tomorrow = moment(fechaEmision).add(1, 'days').format('YYYY-MM-DD');

                    strSql = "SELECT terminal, cod_Tipo_Comprob, sum(total) as total, count(*) as cnt " +
                        " FROM INVOICE_HEADER " +
                        " WHERE FECHA_EMISION < TO_DATE(:1,'YYYY-MM-DD') AND " +
                        "       FECHA_EMISION >= TO_DATE(:2,'YYYY-MM-DD') " +
                        "GROUP BY terminal,cod_Tipo_Comprob ";

                    connection.execute(strSql, [tomorrow, date5Ago], {}, function (err, data) {
                        if (err) {
                            callback({status: "ERROR", message: err.message, data: err});
                        } else {
                            response = data.rows.map(function (item) {
                                return {
                                    terminal: item.TERMINAL,
                                    date: item.DATE,
                                    cnt: item.CNT,
                                    total: item.TOTAL
                                };
                            });

                            callback(undefined, {
                                status: "OK",
                                data: response
                            });
                        }
                    });
                }
            });
        }
    }

    getCountByMonth (params, callback) {
        var self = this;
        var pool = self.cn.pool;
        var strSql,
            fechaEmision,
            month5Ago,
            nextMonth,
            util = require('util'),
            moment = require('moment'),
            response;

        if (pool) {
            pool.getConnection (function (err, connection) {
                if (err) {
                    console.log("%s, Error en Oracle getCountByDate.", new Date());
                    self.cn.doRelease(connection);
                } else {

                    fechaEmision = moment(moment().format('YYYY-MM-DD')).subtract(moment().date() - 1, 'days').format('YYYY-MM-DD');

                    if (params.fecha !== undefined) {
                        fechaEmision = moment(params.fecha, ['YYYY-MM-DD']).format('YYYY-MM-DD');
                    }
                    month5Ago = moment(fechaEmision).subtract(4, 'months').format('YYYY-MM-DD');
                    nextMonth = moment(fechaEmision).add(1, 'months').format('YYYY-MM-DD');

                    strSql = "" +
                        "SELECT terminal, TO_NUMBER(TO_CHAR(fecha_emision, 'YYYY')) YEAR, " +
                        "       TO_NUMBER(TO_CHAR(fecha_emision, 'MM')) MONTH, " +
                        "       TO_NUMBER(TO_CHAR(fecha_emision, 'YYYYMM')) DIA, " +
                        "       sum(total) as total, count(*) as cnt " +
                        " FROM INVOICE_HEADER " +
                        " WHERE FECHA_EMISION < TO_DATE(:1,'YYYY-MM-DD') AND " +
                        "       FECHA_EMISION >= TO_DATE(:2,'YYYY-MM-DD') " +
                        "GROUP BY terminal,TO_NUMBER(TO_CHAR(fecha_emision, 'YYYY')), " +
                        "       TO_NUMBER(TO_CHAR(fecha_emision, 'MM')), " +
                        "       TO_NUMBER(TO_CHAR(fecha_emision, 'YYYYMM')) ";

                    connection.execute(strSql, [nextMonth, month5Ago], {}, function (err, data) {
                        if (err) {
                            callback({status: "ERROR", message: err.message, data: err});
                        } else {
                            response = data.rows.map(function (item) {
                                return {
                                    terminal: item.TERMINAL,
                                    year: item.YEAR,
                                    month: item.month,
                                    dia: item.dia,
                                    cnt: item.CNT,
                                    total: item.TOTAL
                                };
                            });

                            callback(undefined, {
                                status: "OK",
                                data: response
                            });
                        }
                    });
                }
            });
        }
    }

    getDistinct (distinct, params, callback) {
        var self = this;
        var strSql;
        var pool = self.cn.pool;

        if (pool) {
            pool.getConnection(function (err, connection) {
                if (err) {
                    if (callback) return callback(err);
                } else {
                    strSql = `SELECT DISTINCT ${distinct} FROM INVOICE_HEADER WHERE TERMINAL = :1 ORDER BY ${distinct}`;
                    connection.execute(strSql, [params.terminal], {outFormat: self.cn.oracledb.ARRAY}, function (err, data) {
                        self.cn.doRelease(connection);
                        if (err) {
                            if (callback) return callback({status: "ERROR", message: err.message, data: err});
                        } else {
                            let result = data.rows.map(function (item) {return item[0];});
                            if (callback) return callback(undefined, {
                                status: "OK",
                                totalCount: result.length,
                                data: result
                            });
                        }
                    });
                }
            });
        }

    }

    getNoRates (params, callback) {

    }

    getContainersNoRates (params, callback) {

        var self = this;
        var strSql;
        var pool = self.cn.pool;

        if (pool) {
            pool.getConnection(function (err, connection) {
                if (err) {
                    if (callback) return callback(err);
                } else {
                    strSql = "SELECT DISTINCT ID1.CONTENEDOR " +
                        "   FROM INVOICE_DETAIL ID1 " +
                        "       INNER JOIN INVOICE_HEADER IH1 ON ID1.INVOICE_HEADER_ID = IH1.ID " +
                        "   WHERE NOT EXISTS ( " +
                        "           SELECT * " +
                        "           FROM INVOICE_DETAIL INVD " +
                        "               INNER JOIN INVOICE_HEADER INVH ON INVD.INVOICE_HEADER_ID = INVH.ID " +
                        "               INNER JOIN TARIFARIO_TERMINAL TT ON TT.CODE = INVD.CODE AND TT.TERMINAL = INVH.TERMINAL " +
                        "               INNER JOIN TARIFARIO T ON T.ID = TT.TARIFARIO_ID " +
                        "           WHERE RATE is not null AND " +
                        "                   INVD.CONTENEDOR = ID1.CONTENEDOR AND " +
                        "                   INVH.TERMINAL = IH1.TERMINAL ) AND " +
                        "   IH1.TERMINAL = :1 and " +
                        "   CONTENEDOR IS NOT NULL ";
                    connection.execute(strSql, [params.terminal], {}, function (err, data) {
                        let result;
                        self.cn.doRelease(connection);
                        if (err) {
                            if (callback) return callback({status: "ERROR", message: err.message, data: err});
                        } else {
                            result = data.rows.map(function (item) {
                                    return {conte: item.CONTENEDOR};
                            });
                            result = {
                                status: "OK",
                                totalCount: result.length,
                                data: result
                            };
                            if (callback) return callback(undefined, result);
                        }
                    });
                }
            });
        }
    }

    getTotal (params, callback) {
        callback();
    }

    getTotalByClient (params, options, callback) {
        callback();
    }

    /*
        add (gate, callback) {
            var self = this;
            var strSql,
                values;
            var pool = self.cn.pool;
            var moment = require("moment");

            if (pool) {
                pool.getConnection(function (err, connection) {
                    if (err) {
                        console.log("%s, Error en Oracle add Gate.", new Date());
                        if (callback) return callback(err);
                    } else {
                        strSql = "insert into GATES " +
                            "(ID," +
                            "TERMINAL," +
                            "BUQUE," +
                            "VIAJE," +
                            "CONTENEDOR," +
                            "CARGA," +
                            "MOV," +
                            "TIPO," +
                            "GATETIMESTAMP," +
                            "TURNOINICIO," +
                            "TURNOFIN," +
                            "PATENTECAMION," +
                            "TREN) VALUES (" +
                            "gates_seq.nextval," +
                            " :terminal, :buque, :viaje, :contenedor, :carga, :mov, :tipo, to_date(:gateTimestamp, 'YYYY-MM-DD HH24:MI:SS'), to_date(:turnoInicio, 'YYYY-MM-DD HH24:MI:SS'), to_date(:turnoFin, 'YYYY-MM-DD HH24:MI:SS'), :patenteCamion, :tren)";
                        values = {
                            terminal: gate.terminal,
                            buque: gate.buque,
                            viaje: gate.viaje,
                            contenedor: gate.contenedor,
                            carga: gate.carga,
                            mov: gate.mov,
                            tipo: gate.tipo,
                            gateTimestamp: moment(gate.gateTimestamp).format("YYYY-MM-DD hh:mm:ss"),
                            turnoInicio: (gate.turnoInicio === null ) ? null : moment(gate.turnoInicio).format("YYYY-MM-DD hh:mm:ss"),
                            turnoFin: (gate.turnoFin === null ) ? null : moment(gate.turnoFin).format("YYYY-MM-DD hh:mm:ss"),
                            patenteCamion: gate.patenteCamion,
                            tren: gate.tren
                        };
                        connection.execute(strSql, values, {autoCommit:true}, function(err, result) {
                            self.cn.doRelease(connection);
                            if (err) {
                                if (callback) return callback(err);
                            } else {
                                result = {
                                    status: 'OK',
                                    data: result
                                };
                                if (callback) return callback(undefined, result);
                            }
                        });

                    }
                });
            }
        }
    */
    toString() {
        return "Invoice class on Oracle 11g";
    }

}

class InvoiceMongoDB {
    constructor (model) {
        this.model = model;
        this.payings = require('../models/paying.js');
        this.comments = require('../models/comment.js');
    }

    add (param, io, callback) {
        var self = this;
        var invoice,
            errMsg,
            subTotalCheck,
            usr,
            postData,
            strSubject,
            body,
            buqueId,
            buqueDesc,
            viaje,
            fecha,
            buque,
            contenedor,
            cont,
            mailer,
            invoice2add,
            util = require('util'),
            moment = require('moment');

        var mail = require("../include/emailjs"),
            dateTime = require('../include/moment'),
            config = require('../config/config.js');

        var Invoice = this.model;

        try {

            usr = param.usr;
            delete param.usr;
            postData = param;

            invoice = {
                terminal: usr.terminal,

                nroPtoVenta: postData.nroPtoVenta,
                codTipoComprob: parseInt(postData.codTipoComprob.toString().trim(), 10),
                nroComprob: postData.nroComprob,
                codTipoAutoriz: postData.codTipoAutoriz,
                codAutoriz: postData.codAutoriz,
                codTipoDoc: postData.codTipoDoc,
                nroDoc: postData.nroDoc,
                clienteId: postData.clientId,
                razon: postData.razon.trim(),
                importe: {
                    gravado: Math.abs(postData.impGrav),
                    noGravado: Math.abs(postData.impNoGrav),
                    exento: Math.abs(postData.impExento),
                    subtotal: Math.abs(postData.impSubtot),
                    iva: Math.abs(postData.impIva),
                    otrosTributos: postData.impOtrosTrib,
                    total: Math.abs(postData.impTotal)
                },
                codMoneda: postData.codMoneda,
                cotiMoneda: postData.cotiMoneda,
                observa: postData.observa,
                codConcepto: postData.codConcepto,
                fecha: {
                    emision: moment(postData.fechaEmision, "YYYY-MM-DDT00:00:00.000.Z"),
                    vcto: moment(postData.fechaVcto, "YYYY-MM-DDT00:00:00.000.Z"),
                    desde: moment(postData.fechaServDesde, "YYYY-MM-DDT00:00:00.000.Z"),
                    hasta: moment(postData.fechaServHasta, "YYYY-MM-DDT00:00:00.000.Z"),
                    vctoPago: moment(postData.fechaVctoPago, "YYYY-MM-DDT00:00:00.000.Z")
                },
                detalle: [],
                otrosTributos: [],
                estado: [
                    {
                        estado: "Y",
                        grupo: "ALL",
                        user: usr.user
                    }
                ],
                comment: []
            };

            if (postData.otrosTributos) {
                postData.otrosTributos.forEach(function (item) {

                    var otId = (item.id !== undefined) ? item.id.toString() : null;
                    var otDesc = item.desc;

                    invoice.otrosTributos.push(
                        {
                            id: (otId) ? otId : "",
                            desc: (otDesc) ? otDesc.trim() : "",
                            imponible: Math.abs(item.imponible),
                            imp: item.imp
                        });
                });
            }

            subTotalCheck = 0;
            if (postData.detalle && postData.detalle.length > 0) {
                postData.detalle.forEach(function (container) {
                    buqueId = (container.buqueId !== undefined && container.buqueId !== null) ? container.buqueId.toString() : "";
                    buqueDesc = container.buqueDesc;
                    viaje = container.viaje;
                    fecha = (container.fecha !== undefined && container.fecha !== "" && container.fecha != null) ? moment(container.fecha, "YYYY-MM-DD") : "";
                    buque = {
                        codigo: (buqueId) ? buqueId.trim() : "",
                        nombre: (buqueDesc) ? buqueDesc.trim() : "",
                        viaje: (viaje) ? viaje.trim() : "",
                        fecha: fecha
                    };

                    contenedor = container.contenedor;
                    cont = {
                        contenedor: (contenedor) ? container.contenedor.trim() : "",
                        IMO: container.IMO,
                        buque: buque,
                        items: []
                    };
                    if (container.items) {
                        container.items.forEach(function (item) {
                            cont.items.push(
                                {
                                    id: item.id,
                                    cnt: Math.abs(item.cnt),
                                    uniMed: item.uniMed,
                                    impUnit: item.impUnit,
                                    impTot: Math.abs(item.impTot)
                                });
                            subTotalCheck += Math.abs(item.impTot);
                        });
                    } else {
                        errMsg = util.format("Invoice INS: %s", "El contenedor no posee items.");
                        if (callback) return callback({
                                                status: "ERROR",
                                                message: errMsg,
                                                data: errMsg
                                            });
                    }
                    invoice.detalle.push(cont);
                });

            } else {
                errMsg = util.format("Invoice INS: %s - %s. - %j", "El comprobante no posee detalles.", usr.terminal, postData);
                if (callback) return callback({
                                status: "ERROR",
                                message: errMsg,
                                data: errMsg
                            });
            }

        } catch (error) {
            strSubject = util.format("AGP - %s - ERROR", usr.terminal);
            body = util.format('Error al insertar comprobante. %s. \n%s',  error.message, JSON.stringify(postData));

            mailer = new mail.mail(config.email);
            mailer.send(usr.email, strSubject, body, function () {});
            if (callback) return callback({
                            status: "ERROR",
                            message: body,
                            data: body
                        });
        }

        invoice2add = new Invoice(invoice);
        invoice2add.save(function (errSave, data) {
            var socketMsg;
            if (!errSave) {

                socketMsg = {
                    status: 'OK',
                    data : {
                        terminal : data.terminal,
                        _id: data._id,
                        emision : data.fecha.emision,
                        codTipoComprob : data.codTipoComprob,
                        razon: data.razon,
                        nroComprob: data.nroComprob,
                        total: data.importe.total
                    }
                };
                io.emit('invoice', socketMsg);

                var comment = 'Comprobante transferido correntamente.';
                var commentState = 'Y';

                if ((subTotalCheck > postData.impSubtot + 2) || (subTotalCheck < postData.impSubtot - 2)) {
                    comment = util.format("El subtotal del comprobante es incorrecto, la suma es %d y se informa %d. - %s.", subTotalCheck, postData.impSubtot, usr.terminal);
                    data.estado[0].estado = 'T';
                }

                self.comments.create({
                    invoice: data._id,
                    title: 'Transferencia comprobante.',
                    comment: comment,
                    state: commentState,
                    user: usr.user,
                    group: "ALL"
                }, function (err, commentAdded) {
                    if (err) {

                    } else {
                        data.comment.push(commentAdded._id);
                        data.save(function () {
                            if (callback) return callback(undefined, {
                                                    status: "OK",
                                                    data: data
                                                });
                        });
                    }
                });

            } else {
                //TODO crear objecto para tratar los errores, en este caso trato el tema de duplicados.
                if (errSave.code === 11000) {
                    Invoice.find({
                        terminal: usr.terminal,
                        codTipoComprob: invoice.codTipoComprob,
                        nroComprob: invoice.nroComprob,
                        nroPtoVenta: invoice.nroPtoVenta
                    }, function (err, invoices) {

                        var estado = invoices[0].resend;
                        if (estado === 1) {
                            Invoice.remove({_id : invoices[0]._id}, function (err, delInvoice) {
                                this.comments.remove({invoice: invoices[0]._id}, function (errComment, delComment) {
                                    param.usr = usr;
                                    self.add(param, callback);
                                });
                            });
                        } else {
                            errMsg = util.format('Error INS: El tipo de comprobante: %s, número: %s, fue transferido el %s:\n - ERROR:%s', invoices[0].codTipoComprob, invoices[0].nroComprob, dateTime.getDateTimeFromObjectId(invoices[0]._id), errSave);

                            if (callback) return callback({
                                status: "ERROR",
                                message: "Error insertando Comprobante",
                                data: errMsg
                            });
                        }

                    });
                } else {
                    strSubject = util.format("AGP - %s - ERROR", usr.terminal);
                    errMsg = util.format('Invoice INS: %s -\n%s - %s', errSave, JSON.stringify(postData), usr.terminal);

                    mailer = new mail.mail(config.email);
                    mailer.send(usr.email, strSubject, errMsg, function () {});
                    if (callback) return callback({
                                            status: "ERROR",
                                            data: errMsg
                                        });
                }
            }
        });
    }

    getInvoice (params, callback) {
        var param = {
                _id: params._id
            },
            invoice;

        if (params.terminal)
            param.terminal = params.terminal;

        invoice = this.model.find(param);
        invoice.populate({path: 'payment'});
        invoice.exec(function(err, invoices){
            if (err) {
                if (callback) return callback({status:'ERROR', message: err.message, data: err});
            } else {
                if (callback) return callback(undefined, {status:"OK", data: invoices[0]||null});
            }
        });
    }

    getInvoices (filtro, callback) {
        var param = {},
            fecha,
            invoice,
            states,
            order,
            skip,
            limit,
            tasksAsync = [],
            taskAsync,
            async = require("async"),
            moment = require("moment");
        var Invoice = this.model;

        if (!filtro) {
            throw "Debe proveer el parametro filtro";
        }

        if (filtro.fechaInicio || filtro.fechaFin) {
            param["fecha.emision"] = {};
            if (filtro.fechaInicio) {
                fecha = moment(filtro.fechaInicio, 'YYYY-MM-DD').toDate();
                param["fecha.emision"]['$gte'] = fecha;
            }
            if (filtro.fechaFin) {
                fecha = moment(filtro.fechaFin, 'YYYY-MM-DD').toDate();
                param["fecha.emision"]['$lte'] = fecha;
            }
        }
        if (filtro.nroPtoVenta) {
            param.nroPtoVenta = filtro.nroPtoVenta;
        }
        if (filtro.codTipoComprob) {
            param.codTipoComprob = filtro.codTipoComprob;
        }
        if (filtro.nroComprobante) {
            param.nroComprob = filtro.nroComprobante;
        }
        if (filtro.razonSocial) {
            param.razon = {$regex: filtro.razonSocial};
        }
        if (filtro.documentoCliente) {
            param.nroDoc = filtro.documentoCliente;
        }

        if (filtro.contenedor) {
            param['detalle.contenedor'] = filtro.contenedor;
        }

        if (filtro.buqueNombre) {
            param['detalle.buque.nombre'] = filtro.buqueNombre;
        }

        if (filtro.viaje) {
            param['detalle.buque.viaje'] = filtro.viaje;
        }

        if (filtro.code) {
            param['detalle.items.id'] = filtro.code;
        }

        if (filtro.payment === '1') {
            param.payment = {$exists: true};
        }

        if (filtro.rates) {
            param['detalle.items.id'] = {$in: filtro.rates};
        }

        if (filtro.estado) {
            states = filtro.estado.split(",");
            param.$or = [
                { estado: {$size: 1, $elemMatch: {estado: {$in: states}, grupo: 'ALL'} } },
                { 'estado.1': { $exists: true }, estado: {$elemMatch: {estado: {$in: states}, grupo: filtro.group} } }
            ];
        }

        if (filtro.resend) {
            param.resend = filtro.resend;
        }

        param.terminal = filtro.terminal;

        taskAsync = function (asyncCallback) {
            invoice = Invoice.find(param, {
                nroPtoVenta: 1,
                codTipoComprob: 1,
                nroComprob: 1,
                razon: 1,
                'importe.total': 1,
                //'detalle': 1,
                estado:1,
                fecha: 1
            });
            invoice.populate({path: 'payment'});

            if (filtro.order) {
                order = JSON.parse(filtro.order);
                invoice.sort(order[0]);
            } else {
                invoice.sort({codTipoComprob: 1, nroComprob: 1});
            }

            if (filtro.limit) {
                limit = parseInt(filtro.limit, 10);
                skip = parseInt(filtro.skip, 10);
                invoice.skip(skip).limit(limit);
            }

            invoice.lean();
            invoice.exec(function (err, invoices) {
                if (!err) {
                    asyncCallback(undefined, invoices);
                } else {
                    asyncCallback(err);
                }
            });
        };
        tasksAsync.push(taskAsync);

        taskAsync = function (asyncCallback) {
            Invoice.count(param, function (err, cnt) {
                if (err) {
                    asyncCallback(err);
                } else {
                    asyncCallback(undefined, cnt);
                }
            });
        };
        tasksAsync.push(taskAsync);

        async.parallel(tasksAsync, function (err, data) {
            var cnt = data[1],
                datos = data[0],
                result = {};

            if (err) {
                if (callback !== undefined) return callback({status: "ERROR", message: err.message, data: err});
            } else {
                result = {
                    status: 'OK',
                    data: datos,
                    pageCount: (limit > datos.length) ? datos.length : limit,
                    page: skip,
                    totalCount: cnt
                };
                if (callback !== undefined) return callback(undefined,  result);
            };
        });

    }

    getCounts (params, callback) {
        var self = this;
        var Invoice = self.model;
        var Enumerable = require('linq');
        var moment = require('moment');

        var jsonParam = [],
            match = {$match: {}},
            fechaEmision = moment(moment().format('YYYY-MM-DD')).toDate(),
            tomorrow,
            response;

        if (params.fecha !== undefined) {
            fechaEmision = moment(params.fecha, ['YYYY-MM-DD']).toDate();
        }
        tomorrow = moment(fechaEmision).add(1, 'days').toDate();
        match['$match'] = {'fecha.emision' : {$gte: fechaEmision, '$lt': tomorrow}};
        jsonParam.push(match);

        jsonParam.push({
            $group: {
                _id: {terminal: '$terminal', codTipoComprob: '$codTipoComprob'},
                total: {$sum: '$total'},
                cnt: {$sum: 1}
            }
        });
        jsonParam.push({$project : {_id: false, terminal: '$_id.terminal', codTipoComprob: '$_id.codTipoComprob', cnt : '$cnt', total: '$total'}});
        jsonParam.push({$sort: {'terminal': 1, 'codTipoComprob': 1}});

        Invoice.aggregate(jsonParam, function (err, data) {
            if (err) {
                callback({status: 'ERROR', data: err.message});
            } else {
                response = Enumerable.from(data)
                    .groupBy('$.codTipoComprob',
                    function (item) {
                        return item;
                    },
                    function (job, grouping) {
                        var grupo = grouping.getSource(),
                            cnt = grouping.sum(function (item) {
                                return item.cnt;
                            }),
                            tot = grouping.sum(function (item) {
                                return item.total;
                            }),
                            grupoItem = {
                                codTipoComprob: job,
                                cnt: cnt,
                                total: tot
                            };

                        grupo.forEach(function (item) {
                            var porcenCnt = item.cnt * 100 / cnt,
                                porcenTotal = item.total * 100 / tot;

                            grupoItem[item.terminal] = {
                                cnt: [item.cnt, porcenCnt],
                                total: [item.total, porcenTotal]
                            };
                        });

                        return grupoItem;
                    }).toArray();

                callback(undefined, {status: "OK", data: response});
            }
        });
    }

    getCountByDate (params, callback) {

        var Invoice = this.model;
        var moment = require('moment');
        var date,
            date5Ago,
            tomorrow,
            jsonParam,
            result;

        date = moment(moment().format('YYYY-MM-DD')).toDate();

        if (params.fecha !== undefined) {
            date = moment(params.fecha, 'YYYY-MM-DD').toDate();
        }
        date5Ago = moment(date).subtract(4, 'days').toDate();
        tomorrow = moment(date).add(1, 'days').toDate();

        jsonParam = [
            {$match: { 'fecha.emision': {$gte: date5Ago, $lt: tomorrow} }},
            { $project: {
                fecha: '$fecha.emision',
                accessDate: {$subtract: ['$fecha.emision', 180 * 60 * 1000]},
                terminal: '$terminal',
                total: '$total'}
            },
            { $group : {
                _id : { terminal: '$terminal',
                    year: { $year : "$accessDate" },
                    month: { $month : "$accessDate" },
                    day: { $dayOfMonth : "$accessDate" },
                    date: '$fecha'
                },
                cnt : { $sum : 1 },
                total: { $sum : '$total'}
            }},
            { $project: {
                _id: false,
                terminal: '$_id.terminal',
                date: '$_id.date',
                cnt: '$cnt',
                total: '$total'
            }},
            { $sort: {'date': 1, 'terminal': 1 }}
        ];

        result = Invoice.aggregate(jsonParam);

        result.exec(function (err, data) {
            if (err) {
                callback({status: "ERROR", data: err.message});
            } else {
                callback(undefined, {status: 'OK', data: data});
            }
        });

    }

    getCountByMonth (params, callback) {

        var Invoice = this.model;
        var moment = require('moment');

        var date = moment(moment().format('YYYY-MM-DD')).subtract(moment().date() - 1, 'days').toDate(),
            month5Ago,
            nextMonth,
            jsonParam;

        if (params.fecha !== undefined) {
            date = moment(params.fecha, ['YYYY-MM-DD']).subtract(moment(params.fecha, 'YYYY-MM-DD').date() - 1, 'days');
        }
        month5Ago = moment(date).subtract(4, 'months').toDate();
        nextMonth = moment(date).add(1, 'months').toDate();

        jsonParam = [
            {$match: { 'fecha.emision': {$gte: month5Ago, $lt: nextMonth} }},
            { $project: {
                accessDate: {$subtract: ['$fecha.emision', 180 * 60 * 1000]},
                dia: {$dateToString: { format: "%Y%m", date: {$subtract: ['$fecha.emision', 180 * 60 * 1000]} }},
                terminal: '$terminal',
                total: 1}},
            { $group : {
                _id : { terminal: '$terminal',
                    year: { $year : "$accessDate" },
                    month: { $month : "$accessDate" },
                    dia: '$dia'
                },
                cnt : { $sum : 1 },
                total: { $sum : '$total'}
            }},
            { $sort: {'_id.dia': 1, '_id.terminal': 1 }}
        ];

        Invoice.aggregate(jsonParam, function (err, data) {
            if (err) {
                if (callback) return callback({status: "ERROR", data: err.message});
            } else {
                if (callback) return callback(undefined, {status: 'OK', data: data});
            }
        });
    }

    getDistinct (distinct, params, callback) {
        var jsonParam;
        jsonParam = {
            terminal: params.terminal
        };

        this.model.distinct(distinct, jsonParam, function (err, data) {
            if (err) {
                if (callback) return callback({status: "ERROR", message: err.message, data: err});
            } else {
                data = data.sort();
                if (callback) return callback(undefined, {
                    status: "OK",
                    totalCount: data.length,
                    data: data
                });
            }
        });
    }

    getNoRates (params, callback) {
        var terminal = params.terminal,
            _price = require('../lib/price.js'),
            Invoice = this.model,
            _rates,
            skip,
            limit,
            fecha,
            param,
            invoices,
            errorResult;

        _rates = new _price(terminal);

        _rates.rates(function (err, rates) {

            if (rates.length > 0) {

                skip = parseInt(params.skip, 10);
                limit = parseInt(params.limit, 10);


                param = {
                    terminal : terminal,
                    'detalle.items.id': {$nin: rates}
                };

                if (params.fechaInicio || params.fechaFin) {
                    param["fecha.emision"] = {};
                    if (params.fechaInicio) {
                        fecha = moment(moment(params.fechaInicio, 'YYYY-MM-DD')).toDate();
                        param["fecha.emision"]['$gte'] = fecha;
                    }
                    if (params.fechaFin) {
                        fecha = moment(moment(params.fechaFin, 'YYYY-MM-DD')).toDate();
                        param["fecha.emision"]['$lte'] = fecha;
                    }
                }

                if (params.contenedor) {
                    param['detalle.contenedor'] = params.contenedor;
                }

                if (params.razonSocial) {
                    param.razon = {$regex: params.razonSocial};
                }

                invoices = Invoice.find(param);
                invoices.limit(limit).skip(skip);

                if (params.order) {
                    var order = JSON.parse(params.order);
                    invoices.sort(order[0]);
                } else {
                    invoices.sort({codTipoComprob: 1, nroComprob: 1});
                }
                invoices.lean();
                invoices.exec(function (err, invoices) {
                    var pageCount = invoices.length;
                    Invoice.count(param, function (err, cnt) {
                        var dataResult = {
                            status: 'OK',
                            totalCount: cnt,
                            pageCount: (limit > pageCount) ? limit : pageCount,
                            page: skip,
                            data: invoices
                        };
                        if (callback) return callback(undefined, dataResult);
                    });
                });
            } else {
                errorResult = {
                    status: 'ERROR',
                    data: 'La terminal no tiene Tasa a las Cargas Asociadas.'
                };
                if (callback) return callback(errorResult);
            }
        });

    }

    getContainersNoRates (params, callback) {

        var terminal = params.terminal,
            _price = require('../lib/price.js'),
            _rates,
            paramTotal,
            Enumerable = require("linq"),
            inv,
            task,
            tasks = [],
            Invoice = this.model,
            async = require("async");

        _rates = new _price(terminal);

        _rates.rates(function (err, rates) {

            var _date = new Date();
            var time = _date.getTime();
            var param = {
                    terminal : terminal,
                    codTipoComprob : 1
                },
                fecha = '';

            task = function (asyncCallback) {

                if (params.razonSocial) {
                    param.razon = {$regex: params.razonSocial}
                }

                paramTotal = [
                    { $match: param },
                    { $project : {'detalle.items.id': 1, 'detalle.contenedor': 1, _id: 0}},
                    { $unwind: '$detalle' },
                    { $unwind: '$detalle.items' },
                    { $match: {'detalle.items.id' : {$in: rates }}},
                    { $group: {_id: {cont: '$detalle.contenedor'}}},
                    { $project : {contenedor : '$_id.cont'} }
                ];

                inv = Invoice.aggregate(paramTotal);
                inv.exec(function (err, data1) {
                    var contes = Enumerable.from(data1).select('$.contenedor');
                    asyncCallback(undefined, contes);
                });
            };
            tasks.push(task);

            task = function (asyncCallback) {
                //Solo filtra fecha de este lado, en el aggregate trae todas las tasas a las cargas de contenedor históricas.
                if (params.fechaInicio || params.fechaFin) {
                    param["fecha.emision"] = {};
                    if (params.fechaInicio) {
                        fecha = moment(params.fechaInicio, 'YYYY-MM-DD').toDate();
                        param["fecha.emision"]['$gte'] = fecha;
                    }
                    if (params.fechaFin) {
                        fecha = moment(params.fechaFin, 'YYYY-MM-DD').toDate();
                        param["fecha.emision"]['$lte'] = fecha;
                    }
                }

                if (params.buqueNombre) {
                    param['detalle.buque.nombre'] = params.buqueNombre;
                }
                if (params.viaje) {
                    param['detalle.buque.viaje'] = params.viaje;
                }

                Invoice.distinct('detalle.contenedor', param, function (err, data2){

                    var contDist = Enumerable.from(data2);
                    asyncCallback(undefined, contDist)
                });
            };
            tasks.push(task);

            async.parallel( tasks, function (err, data) {
                var contes = data[0];
                var contDist = data[1];

                var dife = contDist.except(contes)
                    .orderBy()
                    .select(function (item) {
                        return {conte: item};
                    })
                    .toArray();
                _date = new Date();
                time = _date.getTime() - time;
                console.log("time %s", time / 1000);
                callback(undefined, {status: 'OK', totalCount: dife.length, data: dife});
            });
        });
    }

    getTotal (params, callback) {
        var Invoice = this.model,
            invoices,
            param,
            moment = require("moment");

        param = {
            'fecha.emision': {
                $gte: moment(params.fechaInicio, ['YYYY-MM-DD']).toDate(),
                $lte: moment(params.fechaFin, ['YYYY-MM-DD']).toDate()
            }
        };

        invoices = Invoice.aggregate([
            {$match: param},
            {$project: {
                terminal: 1,
                total:1
            }},
            {$group: {
                _id: {
                    terminal: "$terminal"
                },
                total: {$sum: "$total"},
                cnt: {$sum: 1},
                avg: {$avg: "$total"}
            }},
            {$project: {
                _id: false,
                terminal: "$_id.terminal",
                total: "$total",
                cnt: '$cnt',
                avg: '$avg'
            }}
        ]);
        invoices.exec(function (err, data) {
            var result;

            result = {
                status: "OK",
                data: data
            };

            if (callback) return callback(err, result);
        });
    }

    getTotalByClient (params, options, callback) {
        var self = this,
            param,
            clientArr = [],
            Enumerable = require('linq'),
            invoices,
            paramLocal,
            Invoice = this.model,
            moment = require('moment');

        param = {
            'fecha.emision': {
                $gte: moment(params.fechaInicio, ['YYYY-MM-DD']).toDate(),
                $lte: moment(params.fechaFin, ['YYYY-MM-DD']).toDate()
            }
        };

        if (params.terminal !== undefined && params.terminal !== null) {
            param.terminal = params.terminal;
        }
        if (params.clients) {
            if (typeof clients === 'string') {
                clientArr.push(params.clients);
            } else {
                clientArr = params.clients;
            }
            param.razon = {$in: clientArr};
        }

        paramLocal = [
            {$match: param},
            {$project: {
                terminal: 1,
                razon: 1,
                cuit: '$nroDoc',
                total: 1,
                fecha: 1
            }},
            {$group: {
                _id: {
                    terminal: "$terminal",
                    razon: "$razon",
                    cuit: "$cuit"
                },
                total: {$sum: "$total"},
                max: {$max: "$total"},
                cnt: {$sum: 1},
                avg: {$avg: "$total"}
            }},
            {$project: {
                _id: false,
                terminal: "$_id.terminal",
                cuit: '$_id.cuit',
                razon: "$_id.razon",
                total: "$total",
                max: "$max",
                cnt: '$cnt',
                avg: '$avg'
            }},
            {$sort: {"total": -1}}
        ];
        if (params.top) {
            paramLocal.push({$limit: parseInt(params.top) });
        }

        invoices = Invoice.aggregate(paramLocal);

        invoices.exec(function (err, data) {
            var total,
                result,
                response;

            if (err) {
                callback(err);
            } else {
                total = Enumerable.from(data)
                    .sum('$.total');

                if (options.output === 'csv') {
                    response = "CUIT|RAZON|COMP|PROMEDIO|MAXIMA|TOTAL\n";

                    data.forEach(function (item) {
                        response = response +
                            item.cuit +
                            "|" +
                            item.razon +
                            "|" +
                            item.cnt +
                            "|" +
                            item.avg +
                            "|" +
                            item.max +
                            "|" +
                            item.total +
                            "\n";
                    });
                    callback(err, response);
                } else {
                    result = {
                        status: "OK",
                        data: data,
                        total: total,
                        totalCount: data.length
                    };
                    callback(err, result);
                }
            }
        });
    }

    /*
    add (gate, callback) {

        var gate2insert = gate;

        if (gate2insert) {
            this.model.insert(gate2insert, function (errSave, gateNew) {
                var socketMsg;
                if (errSave) {
                    if (callback) callback(errSave);
                } else {
                    socketMsg = {
                        status: 'OK',
                        data: gateNew
                    };
                    if (callback) callback(undefined, socketMsg);
                }
            });
        }
    }
*/
    toString () {
        return "Invoice class on MongoDB";
    }
}

/**
 * Representa un Invoice.
 * @constructor
 * @param {object} connection - Objeto de conexion a la base de datos a implementar.
 */
class Invoice extends Constantes {
    constructor(connection) {
        super();
        if (connection !== undefined) {
            this.connection = connection;
            this.clase = new InvoiceOracle(this.connection);
        } else {
            this.connection = require('../models/invoice.js');
            this.clase = new InvoiceMongoDB(this.connection);
        }
    }

    add (param, io, callback) {
        this.clase.add(param, io, callback);
    }

    getInvoice (params, callback) {
        this.clase.getInvoice(params, callback);
    }

    getInvoices (params, callback) {
        this.clase.getInvoices(params, callback);
    }

    getCounts (params, callback) {
        this.clase.getCounts(params, callback);
    }

    getCountByDate (params, callback) {
        this.clase.getCountByDate(params, callback);
    }

    getCountByMonth (params, callback) {
        this.clase.getCountByMonth(params, callback);
    }

    getDistinct (distinct, params, callback) {
        this.clase.getDistinct(distinct, params, callback);
    }

    getNoRates (params, callback) {
        this.clase.getNoRates(params, callback);
    }

    getContainersNoRates (params, callback) {
        this.clase.getContainersNoRates(params, callback);
    }

    getTotal (params, callback) {
        this.clase.getTotal(params, callback);
    }

    getTotalByClient (params, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        this.clase.getTotalByClient(params, options, callback);
    }

/*
    add (newGate, options, callback) {

        var validate = {},
            trimBody;
        newGate = JSON.parse(JSON.stringify(newGate));

        if (typeof options === 'function') {
            callback = options;
        } else if (typeof options === 'object') {
            if (options.trim) {
                trimBody = require('trim-body');
                trimBody(newGate);
            }
            if (options.validate) {
                validate = this.validate(newGate);
            }
        }
        if (validate.status === 'ERROR') {
            if (callback) return callback(validate);
        } else {
            this.clase.add(newGate, callback);
        }
    }
*/
    toString() {
        var stringClass = this.clase.toString();
        return `${stringClass}\n(by Diego Reyes)`;
    }
}

module.exports = Invoice;