-- ============================================================
-- 06 · ventas: consecutivo POR tipo de documento
--
-- Cambia el índice único de ventas de (empresa_id, numero) a
-- (empresa_id, tipo_documento, numero) para que POS, cotización,
-- electrónica y soporte lleven cada uno su propia secuencia
-- (igual que el desktop: tblventas / tblcotizaciones / electronic_documents).
--
-- Idempotente y seguro en CUALQUIER estado de la BD:
--   • Si existe el índice viejo uq_empresa_numero  → lo elimina.
--   • Si NO existe el nuevo uq_empresa_tipo_numero → lo crea.
-- En una BD fresca (02 ya crea el índice nuevo) esto es un no-op.
-- ============================================================

-- 1) Quitar índice viejo si está presente
SET @has_old := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ventas'
       AND INDEX_NAME = 'uq_empresa_numero'
);
SET @sql := IF(@has_old > 0,
    'ALTER TABLE ventas DROP INDEX uq_empresa_numero',
    'SELECT ''uq_empresa_numero no existe (ok)'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Crear índice nuevo si falta
SET @has_new := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ventas'
       AND INDEX_NAME = 'uq_empresa_tipo_numero'
);
SET @sql := IF(@has_new = 0,
    'ALTER TABLE ventas ADD UNIQUE KEY uq_empresa_tipo_numero (empresa_id, tipo_documento, numero)',
    'SELECT ''uq_empresa_tipo_numero ya existe (ok)'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✓ ventas: consecutivo por tipo_documento' AS resultado;
