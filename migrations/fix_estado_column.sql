ALTER TABLE usuarios 
ALTER COLUMN estado TYPE VARCHAR(20) 
USING (
    CASE 
        WHEN estado = true THEN 'activo' 
        WHEN estado = false THEN 'inactivo' 
        ELSE 'activo' 
    END
);

ALTER TABLE usuarios ALTER COLUMN estado SET DEFAULT 'activo';
