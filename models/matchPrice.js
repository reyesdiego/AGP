/**
 * Created by Administrator on 1/10/14.
 */
var mongoose = require('mongoose');

var matchpPrice = new mongoose.Schema({
	terminal:		{ type: String, required: true},
	codes:			[
		{
			codeAgp:	{type: String, required: true},
			codes:		[String]
		}
	]
});

module.exports = mongoose.model('matchprices', matchpPrice);