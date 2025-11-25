const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, inventarioController.obtener);
router.get('/:id', verifyToken, inventarioController.obtenerPorId);
router.post('/', verifyToken, isAdmin, inventarioController.crear);
router.put('/:id', verifyToken, isAdmin, inventarioController.actualizarCantidad);
router.delete('/:id', verifyToken, isAdmin, inventarioController.eliminar);

module.exports = router;