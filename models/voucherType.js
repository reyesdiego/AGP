/**
 * Created by diego on 6/3/14.
 */

var mongoose = require("mongoose");

var voucher = new mongoose.Schema({
	_id:		{type: Number},
	description:{type: String, required:true}
});

module.exports = mongoose.model('vouchertypes', voucher);