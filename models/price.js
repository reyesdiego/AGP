/**
 * Created by Diego Reyes on 1/10/14.
 */
var mongoose = require('mongoose');

var price = new mongoose.Schema({
	terminal:		{type: String, required: true},
	code:			{type: String, required: true},
	description:	{type: String, required: true},
	unit:			{type: String},
	matches:		[{ type: mongoose.Schema.ObjectId, ref: 'matchprices' }],
	topPrices:		[{
						from:		{type: Date},
						price:		{type: Number, required: true},
						currency:	{type: String}
					}]
});

price.virtual('unitCurrency').get(function(){
	var cur, unit;
	if (this.unit === 'TN')
		unit = 'Tn';
	else if (this.unit === 'CONTAINER')
		unit = 'Container';
	else
		unit = 'Cajón';

	if (this.currency === 'DOL')
		cur = 'U$S';
	else
		cur = '$';

	return cur + '/' + unit;
});

//price.set('toJSON', {virtuals: true,
//	transform: function(doc, ret, options) {
//		delete ret.id;
//		delete ret.unit;
//		delete ret.currency;
//		delete ret.__v;
//		return ret;
//	}
//});

module.exports = mongoose.model('prices', price);