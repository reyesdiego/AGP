/**
 * Created by Diego Reyes on 10/6/14.
 */
var email = require("emailjs");

var mail = function (options) {
    'use strict';
    this.status = options.status;
    delete options.status;
    this.throughBcc = options.throughBcc;
    delete options.throughBcc;

    this.server = email.server.connect(options);

    this.emailSimpleValidate = function (email) {
        var response = false,
            reg = /^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;
        if (reg.test(email)) {
            response = true;
        }
        return response;
    };

    this.emailCaseSensitiveValidate = function (email) {
        var reg = /^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$/,
            response = false;
        if (reg.test(email)) {
            response = true;
        }
        return response;
    };

    this.emailFreeValidate = function (email) {
        var reg = /^([\w-\.]+@(?!gmail.com)(?!yahoo.com)(?!hotmail.com)([\w-]+\.)+[\w-]{2,4})?$/,
            response = false;
        if (reg.test(email)) {
            response = true;
        }
        return response;
    };

};

mail.prototype = {
    send : function (to, subject, text, attachment, callback) {
        'use strict';
        var self = this,
            config = {
                from: "A.G.P. <noreply@puertobuenosaires.gob.ar>",
                to: "A.G.P. <noreply@puertobuenosaires.gob.ar>",
                subject: subject
            },
            tos = [];

        if (typeof text === 'object') {
            if (typeof attachment === 'function') {
                callback = attachment;
            }
            config.attachment = text;
            config.text = '';
        } else {
            if (typeof attachment === 'function') {
                callback = attachment;
            }
        }

        if (typeof to === 'string') {
            if (!this.emailSimpleValidate(to)) {
                return callback({status: "ERROR", data: "La cuenta de email es inválida"});
            } else {
                tos.push(to);
            }
        } else if (typeof to === 'object') {
            to.forEach(function (item) {
                if (!self.emailSimpleValidate(item)) {
                    return callback({status: "ERROR", data: "La cuenta de email es inválida"});
                }
            });
            tos = to;
        }

        if (this.status === true) {
            if (this.throughBcc) {
                config.bcc = tos.join(',');
            } else {
                config.to = tos.join(',');
            }
            this.server.send(config, function (err, message) {
                if (err) {
                    if (typeof callback === 'function') {
                        return callback(err);
                    }
                } else {
                    if (typeof callback === 'function') {
                        return callback(null, message);
                    }
                }
            });
        }
    }
};

exports.mail = mail;
