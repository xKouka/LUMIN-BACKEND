const express = require('express');
const router = express.Router();
const { obtenerBackup } = require('../controllers/backupController');
const { verifyToken } = require('../middleware/auth');

const verificarSuperAdmin = (req, res, next) => {
    // Check req.usuario as set by verifyToken
    if (req.usuario && req.usuario.rol === 'super_admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Requiere privilegios de Super Administrador.' });
    }
};

router.get('/', verifyToken, verificarSuperAdmin, obtenerBackup);

module.exports = router;
