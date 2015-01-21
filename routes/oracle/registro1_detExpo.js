/**
 * Created by diego on 11/19/14.
 */

module.exports = function (app, log){

	var oracle = require('oracle');
	var	config = require('../../config/config.js');

	function getRegistro1DetExpo( req, res){

		oracle.connect(config.oracle, function(err, connection) {
			if (err) { console.log("Error connecting to db:", err); return; }

			var oracleUtils = require('../../include/oracle.js')
			oracleUtils = new oracleUtils();
			var orderBy = oracleUtils.orderBy(req.query.order);

			var skip = parseInt(req.params.skip, 10);
			var limit = parseInt(req.params.limit, 10);
			var strSql = "SELECT * FROM " +
				" (SELECT " +
				"		ID, " +
				"		TIPOREGISTRO, " +
				"		DETALLADA, " +
				"		DET_ANIO, " +
				"		DET_ADUANA, " +
				"		DET_TIPO, " +
				"		DET_NRO, " +
				"		DET_LETRA_CTRL, " +
				"		IMPO_EXPO, " +
				"		DIVISAFOB, " +
				"		MONTOFOB, " +
				"		DIVISAFLETE, " +
				"		MONTOFLETE, " +
				"		DIVISASEGURO, " +
				"		MONTOSEGURO, " +
				"		ADUANASALIDA, " +
				"		PAISDESTINO, " +
				"		FECOFI, " +
				"		FECHA_CUMPLIDO, " +
				"		FECOFIPOSTEMBARQUE, " +
				"		CODIGOLIQUIDADO, " +
				"		TOTALDERECHOSEXPO, " +
				"		REGISTRADO_POR, " +
				"		REGISTRADO_EN, " +
				"		ROW_NUMBER() OVER (ORDER BY " + orderBy + ") R " +
				"	FROM V_REGISTRO1_DETEXPO) " +
				"WHERE R BETWEEN :1 and :2";
			connection.execute(strSql,[skip+1, skip+limit], function (err, data){
				if (err){
					res.send(500, { status:'ERROR', data: err.message });
				} else {
					strSql = "SELECT COUNT(*) AS TOTAL FROM REGISTRO1_DETEXPO";
					connection.execute(strSql, [], function (err, dataCount){
						connection.close();
						if (err){
							res.send(500, { status:'ERROR', data: err.message });
						} else {
							var total = dataCount[0].TOTAL;
							var result = {
								status:'OK',
								totalCount : total,
								pageCount : (limit > total) ? total : limit,
								data: data };
							res.send(200, result);
						}
					});
				}
			});

		});
	}

	app.get('/afip/registro1_detexpo/:skip/:limit', getRegistro1DetExpo)

};