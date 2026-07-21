-- ============================================================
-- 08 · dian_unidades_medida: marcar/curar las unidades de USO COMÚN
--
-- El catálogo DIAN (07) trae 1093 unidades con nombres de baja calidad
-- (traducciones automáticas y unas pocas filas con mojibake del origen).
-- Para el POS colombiano solo se usan ~25. Aquí:
--   • agregamos `comun` (para mostrarlas primero) y `orden`;
--   • fijamos nombres en español correcto para esas ~25;
--   • dejamos el resto como cola (sus CÓDIGOS siguen siendo válidos para FE).
--
-- Se actualiza por `id` (estable: viene del mismo CSV en 07, igual en todos
-- los entornos) para evitar colisiones de código (p.ej. MGM aparece 2 veces).
-- La unidad estándar/por defecto es id 70 (código 94 = "Unidad").
--
-- Idempotente.
-- ============================================================

SET NAMES utf8mb4;

ALTER TABLE dian_unidades_medida
    ADD COLUMN IF NOT EXISTS comun TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 0;

-- Reset (idempotencia): todo vuelve a "no común" antes de marcar los actuales.
UPDATE dian_unidades_medida SET comun = 0, orden = 0 WHERE comun = 1;

-- Curar nombre + marcar común + orden. (id, nombre, orden)
INSERT INTO dian_unidades_medida (id, codigo, nombre, comun, orden) VALUES
    (70,   '94',  'Unidad',              1, 10),
    (767,  'KGM', 'Kilogramo',           1, 20),
    (692,  'GRM', 'Gramo',               1, 30),
    (843,  'MGM', 'Miligramo',           1, 40),
    (1032, 'TNE', 'Tonelada',            1, 50),
    (802,  'LBR', 'Libra',               1, 60),
    (821,  'LTR', 'Litro',               1, 70),
    (852,  'MLT', 'Mililitro',           1, 80),
    (686,  'GLL', 'Galón',               1, 90),
    (865,  'MTR', 'Metro',               1, 100),
    (495,  'CMT', 'Centímetro',          1, 110),
    (855,  'MMT', 'Milímetro',           1, 120),
    (863,  'MTK', 'Metro cuadrado',      1, 130),
    (864,  'MTQ', 'Metro cúbico',        1, 140),
    (381,  'BX',  'Caja',                1, 150),
    (932,  'PK',  'Paquete',             1, 160),
    (363,  'BG',  'Bolsa',               1, 170),
    (636,  'DZN', 'Docena',              1, 180),
    (938,  'PR',  'Par',                 1, 190),
    (993,  'SET', 'Juego',               1, 200),
    (730,  'HUR', 'Hora',                1, 210),
    (606,  'DAY', 'Día',                 1, 220),
    (797,  'KWH', 'Kilovatio hora',      1, 230),
    (1077, 'WTT', 'Vatio',               1, 240),
    (874,  'NAR', 'Número de artículos', 1, 250)
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    comun  = VALUES(comun),
    orden  = VALUES(orden);

SELECT CONCAT('✓ unidades comunes: ', COUNT(*)) AS resultado
FROM dian_unidades_medida WHERE comun = 1;
