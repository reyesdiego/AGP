/**
 * Created by diego on 11/19/14.
 */

module.exports = function (app, log){

	var oracle = require('oracle');
	var	config = require('../../config/config.js');

	function getRegistro1Solicitud( req, res){

		oracle.connect(config.oracle, function(err, connection) {
			if (err) { console.log("Error connecting to db:", err); return; }

			var skip = parseInt(req.params.skip, 10);
			var limit = parseInt(req.params.limit, 10);
			var strSql = "SELECT * FROM " +
				" (SELECT " +
				"		ID, " +
				"		TIPOREGISTRO, " +
				"		SOLICITUD, " +
				"		SUBSTR( SOLICITUD, 0, 2) as		SOL_ANIO, " +
				"		SUBSTR( SOLICITUD, 3, 3) as		SOL_ADUANA, " +
				"		SUBSTR( SOLICITUD, 6, 4) as		SOL_TIPO, " +
				"		SUBSTR( SOLICITUD, 10, 6) as	SOL_NRO, " +
				"		SUBSTR( SOLICITUD, 16, 1) as	SOL_LETRA_CTRL, " +
				"		CUITATA, " +
				"		NOMBREATA, " +
				"		ESTADO, " +
				"		PROCESO, " +
				"		FECHA_REGISTRO, " +
				"		CUIT_IMPO, " +
				"		LUGAR_OPERATIVO, " +
				"		DEPOSITOORIGEN, " +
				"		DEPOSITODESTINO, " +
				"		MEDIOTRANSPORTEINTERNO, " +
				"		NACMEDIOTRANSPINTERNO, " +
				"		MATRICULAMEDIOTRANSPINTERNO, " +
				"		COMENTARIO, " +
				"		SUMARIA, " +
				"		SUBSTR( sumaria, 0, 2) as	SUM_ANIO, " +
				"		SUBSTR( sumaria, 3, 3) as	SUM_ADUANA, " +
				"		SUBSTR( sumaria, 6, 4) as	SUM_TIPO, " +
				"		SUBSTR( sumaria, 10, 6) as	SUM_NRO, " +
				"		SUBSTR( sumaria, 16, 1) as	SUM_LETRA_CTRL, " +
				"		NOMBREBUQUE, " +
				"		REGISTRADO_POR, " +
				"		REGISTRADO_EN, " +
				"		ROW_NUMBER() OVER (ORDER BY id) R " +
				"	FROM REGISTRO1_SOLICITUD ) " +
				"WHERE R BETWEEN :1 and :2";
			connection.execute(strSql,[skip+1, skip+limit], function (err, data){
				if (err){
					res.send(500, { status:'ERROR', data: err.message });
				} else {
					strSql = "SELECT COUNT(*) AS TOTAL FROM REGISTRO1_SOLICITUD";
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

	app.get('/afip/registro1_solicitud/:skip/:limit', getRegistro1Solicitud)

};