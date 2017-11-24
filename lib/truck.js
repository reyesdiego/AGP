/*
 * Created on Wed Nov 22 2017
 *
 * Copyright (c) 2017 Diego Reyes
 */

"use strict";

var Constantes = require("./constantes.js");

/**
 * Clase Truck en OracleDB
 * @author Diego Reyes
 * @class TruckOracle
 */
class TruckOracle {
    constructor(cn) {
        this.cn = cn;
    }
    add(params) {
        return new Promise((resolve, reject) => {
            reject({
                status: "ERROR",
                message: "NOT IMPLEMENTED YET - add"
            });
        });
    }
    getById(id) {
        return new Promise((reject, resolve) => {
            reject({
                status: "ERROR",
                message: "NOT IMPLEMENTED YET - getById"
            });
        });
    }
}
/**
 * Clase Truck en MongoDB
 * @author Diego Reyes
 * @class TruckMongoDB
 */
class TruckMongoDB {
    constructor(cn) {
        this.model = cn;
    }
    add(params) {
        return new Promise((resolve, reject) => {
            this.model.create(params)
                .then(TruckNew => {
                    resolve({
                        status: "OK",
                        data: TruckNew
                    });
                })
                .catch(err => {
                    reject({
                        status: "ERROR",
                        message: err.message,
                        data: err
                    });
                });
        });
    }
    getById(id) {
        return new Promise((resolve, reject) => {
            this.model.findOne({ _id: id })
                .lean()
                .exec((err, data) => {
                    if (err) {
                        reject({
                            status: "ERROR",
                            message: err.message,
                            data: err
                        });
                    } else {
                        resolve({
                            status: "OK",
                            data: data
                        });
                    }
                });
        });
    }
}
/**
 * Clase Truck. Implementa el manejo de Camiones en ZAP.
 * @author Diego Reyes
 * @class Truck
 */
class Truck extends Constantes {
    constructor(connection) {
        super();
        if (connection !== undefined) {
            this.connection = connection;
            this.clase = new TruckOracle(this.connection);
            this.db = "ORACLE";
        } else {
            this.connection = require("../models/truck.js");
            this.clase = new TruckMongoDB(this.connection);
            this.db = "MONGODB";
        }
    }
    /**
     * Inserta un Camion en la base de datos.
     * 
     * @param {Object} params 
     * @returns {new Promise}
     * @memberof Truck
     */
    add(params) {
        return this.clase.add(params);
    }
    /**
     * Obtiene un Camion de la base de datos filtrado por DNI.
     * 
     * @param {String} id
     * @returns {new Promise}
     * @memberof Truck
     */
    getById(id) {
        return this.clase.getById(id);
    }
}

module.exports = Truck;