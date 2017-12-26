/**
 * Created by diego on 7/3/15.
 */
module.exports = function (log, io, oracle) {
    "use strict";

    var express = require("express"),
        router = express.Router(),
        moment = require("moment"),
        Gate = require("../../lib/gate.js"),
        util = require("util");

    function addGate(req, res) {

        var usr = req.usr,
            gate2insert = req.body,
            errMsg,
            gateLib,
            gateLibOra;

        gate2insert.terminal = usr.terminal;

        gateLib = new Gate();
        gateLib.add(gate2insert, {validate: true, trim: true})
            .then(gateNew => {
                let gate = gateNew.data;
                log.logger.insert("Gate INS: %s - %s - %s", gate._id, usr.terminal, moment(gate.gateTimestamp).format("YYYY-MM-DD hh:mm:ss"));
                io.emit("gate", gateNew);
            })
            .catch(err => {
                errMsg = util.format("%s: %j \n%s", err.message, err.data, usr.terminal, JSON.stringify(req.body));
                log.logger.error(errMsg);
            });

        gateLibOra = new Gate(oracle);
        gateLibOra.add(gate2insert, {validate: true, trim: true})
            .then(gateNew => {
                let gate = gateNew.data;
                log.logger.insert("Gate ORA INS: %s - %s - %s", gate._id, usr.terminal, moment(gate2insert.gateTimestamp).format("YYYY-MM-DD hh:mm:ss"));
                res.status(200).send(gateNew);
            })
            .catch(err => {
                errMsg = util.format("%s: %j \n%s", err.message, err.data, usr.terminal, JSON.stringify(req.body));
                log.logger.error(errMsg);
                res.status(500).send(err);
            });
    }

    /*
     router.use(function timeLog(req, res, next){
     log.logger.info('Time: %s', Date.now());
     next();
     });
     */

    router.post("/", addGate);

    return router;
};