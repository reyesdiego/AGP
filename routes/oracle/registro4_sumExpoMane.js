/**
 * Created by diego on 11/19/14.
 */

module.exports = function (log, pool){
	'use strict'

	var express = require('express');
	var router = express.Router();

	function getRegistro4SumExpoMane( req, res){

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
				"		SUMARIA, " +
				"		SUM_ANIO, " +
				"		SUM_ADUANA, " +
				"		SUM_TIPO, " +
				"		SUM_NRO, " +
				"		SUM_LETRA_CTRL, " +
				"		CONOCIMIENTO, " +
				"		MEDIDA, " +
				"		CONTENEDOR, " +
				"		CONDICION, " +
				"		COMENTARIO, " +
				"		REGISTRADO_POR, " +
				"		REGISTRADO_EN, " +
				"		ROW_NUMBER() OVER (ORDER BY " + orderBy+ ") R " +
				"	FROM V_REGISTRO4_SUMEXPOMANE ) " +
				"WHERE R BETWEEN :1 and :2";
			connection.execute(strSql,[skip+1, skip+limit], function (err, data){
				if (err){
					pool.destroy(connection);
					res.status(500).json({ status:'ERROR', data: err.message });
				} else {
					strSql = "SELECT COUNT(*) AS TOTAL FROM REGISTRO4_SUMEXPOMANE";
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
		log.logger.info('Time registro4_sumexpomane: %s', Date.now());
		next();
	});
	router.get('/registro4_sumexpomane/:skip/:limit', getRegistro4SumExpoMane);

	//app.get('/afip/registro4_sumexpomane/:skip/:limit', getRegistro4SumExpoMane)

	return router;
};