const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const obtenerBackup = async (req, res) => {
    try {
        const date = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${date}.sql`;

        // Construct pg_dump command using environment variables
        // Ensure these variables are set in your .env file
        const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;

        // Use PGPASSWORD environment variable to avoid password prompt
        const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

        const command = `pg_dump -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -U ${DB_USER || 'postgres'} -d ${DB_NAME} --no-owner --no-acl`;

        const child = exec(command, { env, maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        child.stdout.pipe(res);

        child.stderr.on('data', (data) => {
            console.error('pg_dump error:', data);
        });

        child.on('error', (err) => {
            console.error('Error executing pg_dump:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error al generar el respaldo' });
            }
        });

    } catch (error) {
        console.error('Error en obtenerBackup:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerBackup
};
