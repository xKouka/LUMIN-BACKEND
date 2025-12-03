const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación y rol de super admin
router.get('/', verifyToken, usuariosController.obtenerUsuarios);
router.get('/admins', verifyToken, usuariosController.obtenerAdmins);
router.post('/admin', verifyToken, usuariosController.crearUsuarioAdmin);
router.put('/admin/:id', verifyToken, usuariosController.actualizarUsuarioAdmin);
router.delete('/admin/:id', verifyToken, usuariosController.eliminarUsuarioAdmin);

module.exports = router;
