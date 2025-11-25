const express = require('express');
const router = express.Router();
const muestrasController = require('../controllers/muestrasController');
const pdfController = require('../controllers/pdfController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, muestrasController.obtenerTodas);
router.get('/filtro/:tipo', verifyToken, muestrasController.filtrarPorTipo);
router.get('/:id', verifyToken, muestrasController.obtenerPorId);
router.get('/:id/pdf', verifyToken, pdfController.generarPDF);
router.post('/', verifyToken, isAdmin, muestrasController.crear);
router.put('/:id', verifyToken, isAdmin, muestrasController.actualizar);
router.delete('/:id', verifyToken, isAdmin, muestrasController.eliminar);

module.exports = router;