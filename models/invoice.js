/**
 * Created by Administrator on 1/10/14.
 */
var mongoose = require("mongoose"),
    Schema   = mongoose.Schema;

var detalleSchema = new Schema({
    contenedor: {type: String},
    iso: {type: String},
    IMO: {type: Number},
    buque: {
        codigo: {type: String},
        nombre: {type: String},
        viaje: {type: String},
        fecha: {type: Date}
    },
    items: [
        {
            id: {type: String, required: true},
            cnt: {type: Number, required: true},
            uniMed: {type: String},
            impUnit: {type: Number, required: true},
            impTot: {type: Number, required: true}
        }
    ]
});

var invoiceSchema = new Schema({
    terminal: {type: String, required: true},
    tipo: {type: String, enum: ["EXPO", "IMPO"]},
    codTipoComprob: {type: Number, required: true},
    nroPtoVenta: {type: Number},
    nroComprob: {type: Number, required: true},
    codTipoAutoriz: {type: String},
    codAutoriz: {type: Number},
    codTipoDoc: {type: Number},
    nroDoc: {type: Number},
    clientId: {type: String},
    razon: {type: String, required: true},
    importe: {
        gravado: {type: Number},
        noGravado: {type: Number},
        exento: {type: Number},
        iva: {type: Number},
        subtotal: {type: Number},
        otrosTributos: {type: Number},
        total: {type: Number, required: true}
    },
    total: {type: Number},
    codMoneda: {type: String, required: true, enum: ["PES", "DOL", "EUR"]},
    cotiMoneda: {type: Number, required: true, min: 1},
    observa: {type: String },
    codConcepto: {type: Number },
    fecha: {
        emision: {type: Date, required: true},
        vcto: {type: Date},
        desde: {type: Date},
        hasta: {type: Date},
        vctoPago: {type: Date}
    },
    detalle: [detalleSchema],
    otrosTributos: [{
        id: {type: String},
        desc: {type: String},
        imponible: {type: Number},
        imp: {type: Number}
    }],
    estado : [
        {
            estado : {type: String, default: "Y",
                enum: [
                    "R", //Error
                    "Y", //Sin Ver
                    "G", //OK
                    "C", //Revisar
                    "T" //Error en resultado
                ]},
            grupo : {type: String },
            user : {type: String}
        }
    ],
    resend: {type: Number, enum:[0, 1]},
    comment: [{type: mongoose.Schema.ObjectId, ref: "comments" }],
    payment: {type: mongoose.Schema.ObjectId, ref: "payings" }
});

invoiceSchema.index({nroPtoVenta: 1, codTipoComprob: 1, nroComprob: 1, terminal: 1}, {unique: true});

invoiceSchema.pre("save", function (next, done) {
    "use strict";
    var self = this;

    if (self.isNew) {
        self.total = self.importe.total;
        if (self.cotiMoneda && self.codMoneda) {
            if (self.codMoneda === "DOL") {
                if (self.cotiMoneda <= 1) {
                    //next(new Error("La cotización del dolar debe ser mayor a Uno (1)."));
                    next();
                } else {
                    self.total = self.importe.total * self.cotiMoneda;
                }
            } else if (self.codMoneda === "PES" && self.cotiMoneda !== 1) {
                next(new Error("La cotización del peso debe ser Uno (1)."));
            }
        }
        var VoucherType = require("../models/voucherType.js");
        VoucherType.findOne({_id: self.codTipoComprob}, {type: true, _id: false})
            .lean()
            .exec((err, voucherType) => {
                if (voucherType) {
                    self.total = self.total * voucherType.type;
                }
                next();
            });
    } else {
        next();
    }

});

detalleSchema.pre("save", function (next, done) {
    "use strict";
    var codigo = 0,
        nombre = 0,
        viaje = 0,
        totalLength = 0;

    if (this.isNew) {

        if (this.buque && this.__parent.terminal !== "TRP") {
            if (this.buque.codigo !== undefined && this.buque.nombre !== undefined) {

    //          var fecha = 0;

                if (this.buque.codigo !== null) {
                    codigo = (this.buque.codigo.trim().length === 0) ? 0 : 1;
                }

                if (this.buque.nombre !== null) {
                    nombre = (this.buque.nombre.trim().length === 0) ? 0 : 1;
                }

                if (this.buque.viaje !== null) {
                    viaje = (this.buque.viaje.trim().length === 0) ? 0 : 1;
                }

    //          if (this.buque.fecha != null && this.buque.fecha !== '')
    //          fecha = 1;

    //          var totalLength = codigo + nombre + viaje + fecha;
                totalLength = codigo + nombre + viaje;

                if (totalLength > 0 && totalLength < 3) {
                    next(new Error("El dato del Buque: Codigo-Nombre-Viaje es inconsistente. De existir uno de ellos deben estar todos completos."));
                }
            }
        }
    }

    next();

});

module.exports = mongoose.model("invoices", invoiceSchema);