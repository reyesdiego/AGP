/**
 * Created by diego on 11/19/14.
 */

module.exports = function (log, pool){
	'use strict'

	var express = require('express');
	var router = express.Router();

	function getRegistro1Solicitud( req, res){

		pool.acquire(function(err, connection) {
			if (err) {
				console.log(err, "Error acquiring from pool.");
				return;
			}

			var oracleUtils = require('../../include/oracle.js')
			oracleUtils = new oracleUtils();
			var orderBy = oracleUtils.orderBy(req.query.order);

			var skip = parseInt(req.params.skip, 10);
			var limit = parseInt(req.params.limit, 10);
			var strSql = "SELECT * FROM " +
				" (SELECT " +
				"		ID, " +
				"		TIPOREGISTRO, " +
				"		SOLICITUD, " +
				"		SOL_ANIO, " +
				"		SOL_ADUANA, " +
				"		SOL_TIPO, " +
				"		SOL_NRO, " +
				"		SOL_LETRA_CTRL, " +
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
				"		SUM_ANIO, " +
				"		SUM_ADUANA, " +
				"		SUM_TIPO, " +
				"		SUM_NRO, " +
				"		SUM_LETRA_CTRL, " +
				"		NOMBREBUQUE, " +
				"		REGISTRADO_POR, " +
				"		REGISTRADO_EN, " +
				"		ROW_NUMBER() OVER (ORDER BY " + orderBy + ") R " +
				"	FROM V_REGISTRO1_SOLICITUD ) " +
				"WHERE R BETWEEN :1 and :2";
			connection.execute(strSql,[skip+1, skip+limit], function (err, data){
				if (err){
					pool.destroy(connection);
					res.status(500).json({ status:'ERROR', data: err.message });
				} else {
					strSql = "SELECT COUNT(*) AS TOTAL FROM REGISTRO1_SOLICITUD";
					connection.execute(strSql, [], function (err, dataCount){
						pool.release(connection);
						if (err){
							res.status(500).json({ status:'ERROR', data: err.message });
						} else {
							var total = dataCount[0].TOTAL;
							var result = {
								status:'OK',
								totalCount : total,
								pageCount : (limit > total) ? total : limit,
								data: data };
							res.status(200).json(result);
						}
					});
				}
			});

		});
	}

	router.use(function timeLog(req, res, next){
		log.logger.info('Time registro1_solicitud: %s', Date.now());
		next();
	});
	router.get('/registro1_solicitud/:skip/:limit', getRegistro1Solicitud);

//	app.get('/afip/registro1_solicitud/:skip/:limit', getRegistro1Solicitud)

	return router;
};