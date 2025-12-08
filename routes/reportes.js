const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, reportesController.obtenerTodos);
router.post('/', verifyToken, reportesController.crear);

module.exports = router;
