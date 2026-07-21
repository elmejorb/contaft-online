-- ============================================================
-- 11 · Remisión (documento no electrónico) + flag usa_fe + Consumidor Final
--
-- * ventas.tipo_documento: renombra 'pos' → 'remision' (documento interno,
--   NO va a DIAN, consecutivo propio, se imprime). Para empresas de régimen
--   simple / clientes sin facturación electrónica.
-- * empresa_config.usa_fe: si 0, la empresa solo ve Remisión y Cotización;
--   si 1, también Factura Electrónica.
-- * Cliente "CONSUMIDOR FINAL" (identificación DIAN 222222222222) sembrado
--   por empresa para ventas rápidas de mostrador.
--
-- Idempotente.
-- ============================================================

SET NAMES utf8mb4;

-- 1) Enum de tipo_documento: transición pos→remision -------------
ALTER TABLE ventas MODIFY COLUMN tipo_documento
    ENUM('pos','remision','electronica','soporte','cotizacion') NOT NULL DEFAULT 'remision';
UPDATE ventas SET tipo_documento = 'remision' WHERE tipo_documento = 'pos';
ALTER TABLE ventas MODIFY COLUMN tipo_documento
    ENUM('remision','electronica','soporte','cotizacion') NOT NULL DEFAULT 'remision';

-- 2) Flag de facturación electrónica por empresa -----------------
ALTER TABLE empresa_config
    ADD COLUMN IF NOT EXISTS usa_fe TINYINT(1) NOT NULL DEFAULT 0 AFTER iva_incluido;

-- 3) Cliente CONSUMIDOR FINAL por empresa (backfill) -------------
--    222222222222 = adquirente no identificado / consumidor final (DIAN).
INSERT INTO clientes (empresa_id, razon_social, identificacion, tipo_persona, activo, created_at, updated_at)
SELECT e.id, 'CONSUMIDOR FINAL', '222222222222', 'natural', 1, NOW(), NOW()
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM clientes c
    WHERE c.empresa_id = e.id AND c.identificacion = '222222222222'
);

SELECT CONCAT('✓ remisiones=', (SELECT COUNT(*) FROM ventas WHERE tipo_documento='remision'),
              ' · consumidores_final=', (SELECT COUNT(*) FROM clientes WHERE identificacion='222222222222')) AS resultado;
