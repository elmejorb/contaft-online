-- ============================================================
-- 09 · dian_unidades_medida: corregir las 2 filas con mojibake del origen
--
-- El CSV de api-electronica trae 2 filas mal codificadas (bytes C383…).
-- Son unidades de física exóticas. Se corrigen con su nombre oficial
-- UNECE Rec. 20 (estándar de unidades que adopta la DIAN):
--   • A11 = Ångström
--   • KR  = Kiloröntgen
--
-- Se escribe con los BYTES UTF-8 exactos (UNHEX) para no depender de la
-- codificación de la shell/editor. Idempotente (UPDATE por id).
--   Ångström    = C3 85 (Å) 6E 67 73 74 72 (ngstr) C3 B6 (ö) 6D (m)
--   Kiloröntgen = 4B 69 6C 6F 72 (Kilor) C3 B6 (ö) 6E 74 67 65 6E (ntgen)
-- ============================================================

SET NAMES utf8mb4;

UPDATE dian_unidades_medida
   SET nombre = CONVERT(UNHEX('C3856E67737472C3B66D') USING utf8mb4)
 WHERE id = 145;   -- A11

UPDATE dian_unidades_medida
   SET nombre = CONVERT(UNHEX('4B696C6F72C3B66E7467656E') USING utf8mb4)
 WHERE id = 785;   -- KR

SELECT CONCAT('✓ filas mojibake corregidas: ',
       (SELECT COUNT(*) FROM dian_unidades_medida WHERE HEX(nombre) LIKE '%C383%'),
       ' restantes') AS resultado;
