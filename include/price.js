/**
 * Created by diego on 6/12/14.
 */

var price = function (terminal) {
    'use strict';

    this.Price = require("../models/price.js");
    this.matchPrice = require("../models/matchPrice.js");
    this.terminal = terminal;

}

price.prototype = {
	rates: function (withDescription, callback) {
        var Enumerable = require('linq'),
            selfMatchPrice,
            params = [],
            self = this;

        if (typeof withDescription === 'function') {
            callback = withDescription;
        }

        if (callback !== undefined) {
            selfMatchPrice =this.matchPrice;

            if (self.terminal !== undefined) {
                params.push({ $match: { terminal: self.terminal}});
            } else {
                params.push({ $match: { terminal:{$exists : 1}}});
            }

            params.push({ $project: {match:1, price:1}});
            params.push({$unwind:'$match'});
            selfMatchPrice.aggregate( params, function(err, data){
                selfMatchPrice.populate(data, [{ path:'price', match:{rate:{$exists:1}} }], function (err, matchprices) {
                    var ratesDesc = {},
                        result,
                        a;

                        if (err) {
                            if (typeof callback === 'function')
                                return callback(err);
                        } else {
                            result = Enumerable.from(matchprices)
                                .where(function (item){
                                    return item.price != null;
                                });

                            if (withDescription === true){
                                a = result.select(function(item){
                                    ratesDesc[item.match] = item.price.description;
                                    return item;
                                }).toArray();
                                result = ratesDesc;
                            } else {
                                result = result.select(function(item){
                                    return item.match;
                                }).toArray();
                            }
                            if (typeof callback === 'function')
                                return callback( undefined, result);
                        }
                    });
            });
        }
    }
}

exports.price = price;