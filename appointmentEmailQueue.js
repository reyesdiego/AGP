/**
 * Created by diego on 6/1/15.
 */

var mongoose = require('mongoose'),
    mail = require('./include/emailjs'),
    config = require('./config/config.js'),
    async = require("async"),
    moment = require('moment'),
    jade = require('jade');

var Appointment = require('./models/appointment.js');
var AppointmentQueue = require('./models/appointmentEmailQueue.js');

mongoose.connect(config.mongo_url, config.mongo_opts);

function iterator(item, callback) {
    'use strict';
    var html,
        mailer,
        util = require('util'),
        appointment,
        subject;

    appointment = item.appointment;
    appointment.full_name = appointment.full_name;
    appointment.fecha = moment(appointment.inicio).format("DD-MM-YYYY");
    appointment.horario = moment(appointment.inicio).format("HH:mm") + 'hs. a ' + moment(appointment.fin).format("HH:mm") + "hs.";
    appointment.alta = moment(appointment.alta).format("DD-MM-YYYY HH:mm") + " hs.";
    appointment.verifica = (appointment.verifica !== undefined && appointment.verifica !== null && appointment.verifica !== "") ? moment(appointment.verifica).format("DD-MM-YYYY") : appointment.verifica;

    html = jade.renderFile('./public/comprobanteTurno.jade', appointment);
    mailer = new mail.mail(config.email);
    html = {
        data : html,
        alternative: true
    };
    subject = util.format("Coordinación %s para %s.", appointment.contenedor, appointment.full_name);
    mailer.send(appointment.email, subject, html, function (err) {
        if (err) {
            console.error('El REENVIO ha fallado. %s - %s', appointment.email, appointment.contenedor);
            item.status++;
            item.save(function (err, data, rowaffected) {
                callback();
            });
        } else {
            console.log('REENVIO - Confirmación enviada correctamente, %s, se envió mail a %s - %s', appointment.full_name, appointment.email, appointment.contenedor);
            AppointmentQueue.remove({_id: item._id}, function (err) {
                callback();
            });
        }
    });

}

function done() {
    console.log("El proceso finalizo correctamente.");
    process.exit(code=1);
}

var appointmentQueue = AppointmentQueue.find();
appointmentQueue.populate({path: 'appointment'});

appointmentQueue.exec(function (err, data) {
    'use strict';
    if (err) {
        console.log("Ha ocurrido un error consultando AppointmentEmailQueue. %s", err.message);
        process.exit();
    } else {
        async.each(data, iterator, done);
    }
});
