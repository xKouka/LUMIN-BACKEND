const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('=== verifyToken middleware ===');
  console.log('Authorization header:', authHeader);

  const token = authHeader?.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', decoded);
    req.usuario = decoded;
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo admins' });
  }
  next();
};

module.exports = { verifyToken, isAdmin };