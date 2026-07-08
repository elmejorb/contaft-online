-- ============================================================
-- 04 · productos: campos adicionales para el modal completo
-- ============================================================
-- Agrega:
--   • precio_minimo  → 4a. lista de precios ("no vender por debajo de")
--   • etiqueta       → clasificador visual libre (Nuevo, Oferta, Destacado…)
--
-- Idempotente vía IF NOT EXISTS (MariaDB 10.6+). En Hostinger las
-- instancias son 10.11 así que aplica bien.
-- ============================================================

ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS precio_minimo DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER precio_venta_3,
    ADD COLUMN IF NOT EXISTS etiqueta      VARCHAR(60)   NULL             AFTER ubicacion;
