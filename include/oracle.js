/**
 * Created by diego on 1/16/15.
 */

"use strict";

var oracleUtils = function () {
    this.oracledb = require("oracledb");
    this.oracledb.maxRows = 2000;
    this.oracledb.outFormat = this.oracledb.OBJECT;
    //this.oracledb.outFormat = this.oracledb.ARRAY;
    this.pool;
};

oracleUtils.prototype = {

    error: function (error) {
        var msg = error.message;
        //var pro = msg.indexOf('ORA-');
        var pro = msg.split(":");
        var codeEnd;
        var result = {
            code: pro[0],
            message: pro[1]
        };
        /*
        if (pro >= 0) {
            codeEnd = msg.indexOf(':');
            result = {
                code: msg.substr(0, codeEnd),
                message: msg
            };
        }
        */
        return result;
    },

    doRelease: function (connection) {
        if (connection) {
            connection.release(err => {
                if (err) {
                    console.error("doRelease " + err.message);
                }
            });
        }
    },
    orderBy : function (order) {
        var orderBy = "",
            orderType = "ASC";
        if (order) {

            order = JSON.parse(order);

            for (var i= 0, len = order.length; i < len; i++)
                for (var prop in order[i]){
                    if (order[i][prop] === -1) orderType = "DESC";
                    orderBy = prop + " " + orderType;
                }
        } else {
            orderBy = "ID ASC";
        }
        return orderBy;
    }
};

module.exports = oracleUtils;
