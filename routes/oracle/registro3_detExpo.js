/**
 * Created by diego on 11/19/14.
 */

module.exports = function (log, pool){
	'use strict'

	var express = require('express');
	var router = express.Router();

	function getRegistro3DetExpo( req, res){

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
				"		DETALLADA, " +
				"		DET_ANIO, " +
				"		DET_ADUANA, " +
				"		DET_TIPO, " +
				"		DET_NRO, " +
				"		DET_LETRA_CTRL, " +
				"		NRO_ITEM, " +
				"		POSICIONARANCELARIA, " +
				"		ESTADO_MERCA, " +
				"		PROVINCIAORIGEN, " +
				"		PAISDESTINO, " +
				"		UNIDAD_DECLARADA, " +
				"		CANTIDAD_UNIDAD_DECLARADA, " +
				"		BASEIMPONIBLEDOLARES, " +
				"		UNIDAD_ESTADISTICA, " +
				"		CANTIDAD_UNIDADES_ESTAD, " +
				"		REGISTRADO_POR, " +
				"		REGISTRADO_EN, " +
				"		ROW_NUMBER() OVER (ORDER BY " + orderBy + ") R " +
				"	FROM V_REGISTRO3_DETEXPO) " +
				"WHERE R BETWEEN :1 and :2";
			connection.execute(strSql,[skip+1, skip+limit], function (err, data){
				if (err){
					pool.destroy(connection);
					res.status(500).json({ status:'ERROR', data: err.message });
				} else {
					strSql = "SELECT COUNT(*) AS TOTAL FROM REGISTRO3_DETEXPO";
					connection.execute(strSql, [], function (err, dataCount){
						pool.release(connection);
						if (err){
							res.status(200).json({ status:'ERROR', data: err.message });
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
		log.logger.info('Time registro3_detexpo: %s', Date.now());
		next();
	});
	router.get('/registro3_detexpo/:skip/:limit', getRegistro3DetExpo);

//	app.get('/afip/registro3_detexpo/:skip/:limit', getRegistro3DetExpo)

	return router;
};