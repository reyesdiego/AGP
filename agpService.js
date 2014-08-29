/**
 * Created by diego on 8/28/14.
 */

var mongoose = require('mongoose');
var Account = require('./models/account.js');
var http = require('http');
var moment = require('moment');
var mail = require('./include/emailjs');
var config = require('./config/config.js');

mongoose.connect(config.mongo_url, config.mongo_opts);

var date = moment().format('DD-MM-YYYY');

Account.findAll({user:'bactssa'}, function (err, data) {

	if (err)
		console.error(err);
	else {
		if (data.length>0){
			var user = data[0];
			var optionsget = {
				host : 'www.puertobuenosaires.gob.ar', // here only the domain name (no http/https !)
				port : 8080,
				path : '/noMatches/'+user.terminal,
				method : 'GET',
				headers : {token: user.token.token}
			};

			var reqGet = http.request(optionsget, function(res) {

				res.on('data', function(d) {

					var result = JSON.parse(d);
					if (result.status === 'OK'){
						if (result.data.length>0){
							var mailer = new mail.mail(true);
							mailer.send(user.email,
								result.data.length.toString() + " CÓDIGOS SIN ASOCIAR AL " + date,
										user.terminal + '\n\n' + result.data,
									function(){
											process.exit(code=0);
									}
							);
						}
					}
				});
			});
			reqGet.end();
		}
	}

});




