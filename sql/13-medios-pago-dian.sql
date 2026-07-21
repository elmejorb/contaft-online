-- ============================================================
-- 13 · medios_pago: alinear con el catálogo DIAN de la FE
--
-- La factura electrónica exige un medio de pago del catálogo DIAN.
-- api-electronica maneja estos códigos (PaymentMeansCode):
--   10=Efectivo, 11=Transferencia, 12=Cheque, 13=Tarjeta débito, 14=Tarjeta crédito
-- Se agrega `codigo_dian` a medios_pago y se deja la lista operativa mapeada
-- (Bancolombia/Nequi/Daviplata son transferencia → 11).
--
-- Idempotente.
-- ============================================================

SET NAMES utf8mb4;

ALTER TABLE medios_pago
    ADD COLUMN IF NOT EXISTS codigo_dian VARCHAR(4) NULL AFTER tipo;

-- Lista operativa mapeada a DIAN (upsert por nombre único)
INSERT INTO medios_pago (nombre, tipo, codigo_dian, orden) VALUES
    ('Efectivo',        'efectivo',      '10', 1),
    ('Tarjeta débito',  'tarjeta',       '13', 2),
    ('Tarjeta crédito', 'tarjeta',       '14', 3),
    ('Bancolombia',     'transferencia', '11', 4),
    ('Nequi',           'transferencia', '11', 5),
    ('Daviplata',       'transferencia', '11', 6),
    ('Transferencia',   'transferencia', '11', 7),
    ('Cheque',          'cheque',        '12', 8)
ON DUPLICATE KEY UPDATE
    tipo = VALUES(tipo), codigo_dian = VALUES(codigo_dian), orden = VALUES(orden);

-- Backfill de cualquier medio previo sin código (p.ej. 'Tarjeta' genérica)
UPDATE medios_pago
   SET codigo_dian = CASE tipo
        WHEN 'efectivo'      THEN '10'
        WHEN 'transferencia' THEN '11'
        WHEN 'cheque'        THEN '12'
        WHEN 'tarjeta'       THEN '14'
        ELSE 'ZZZ'
       END
 WHERE codigo_dian IS NULL;

-- La 'Tarjeta' genérica queda reemplazada por débito/crédito → se desactiva
-- (no se borra para no romper referencias de ventas antiguas).
UPDATE medios_pago SET activo = 0 WHERE nombre = 'Tarjeta';

SELECT CONCAT('✓ medios_pago con código DIAN: ', COUNT(*)) AS resultado
FROM medios_pago WHERE codigo_dian IS NOT NULL;
