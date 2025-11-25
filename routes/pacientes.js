const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, pacientesController.obtenerTodos);
router.get('/:id', verifyToken, pacientesController.obtenerPorId);
router.post('/', verifyToken, isAdmin, pacientesController.crear);
router.put('/:id', verifyToken, isAdmin, pacientesController.actualizar);
router.delete('/:id', verifyToken, isAdmin, pacientesController.eliminar);

module.exports = router;