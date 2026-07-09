-- ==============================================================
-- 05 · proveedores + proveedor_contactos_notificacion
--
-- Una sola tabla maestra `proveedores` porque un proveedor puede
-- pasar de "no facturador" a "facturador electrónico" con el tiempo,
-- y el maestro (NIT, contacto, cupo, dept/muni) es igual.
--
-- El campo clave es `tipo_soporte`:
--   • fe_recibida       → EL PROVEEDOR emite FE/POS/papel y tú la
--                          registras en Facturas Recibidas.
--   • documento_soporte → TÚ (el adquirente) emites un Documento
--                          Soporte DIAN a nombre del proveedor
--                          porque él no está obligado a facturar.
--
-- Reutiliza los mismos catálogos DIAN que usan los clientes:
--   dian_tipos_documento, dian_tipos_regimen,
--   dian_tipos_responsabilidad, dian_departamentos, dian_municipios.
--
-- Idempotente.
-- ==============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS proveedores (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id           INT UNSIGNED NOT NULL,

    -- Identificación básica
    codigo               VARCHAR(20)  NULL,
    razon_social         VARCHAR(200) NOT NULL,
    nombre_comercial     VARCHAR(200) NULL,
    tipo_persona         ENUM('natural','juridica') NOT NULL DEFAULT 'juridica',
    tipo_documento_id    INT UNSIGNED NULL,     -- FK lógica a dian_tipos_documento
    identificacion       VARCHAR(30)  NOT NULL,
    dv                   VARCHAR(2)   NULL,
    matricula_mercantil  VARCHAR(30)  NULL,

    -- Contacto
    email                VARCHAR(150) NULL,
    telefono             VARCHAR(50)  NULL,
    whatsapp             VARCHAR(50)  NULL,
    direccion            VARCHAR(200) NULL,
    departamento_id      INT UNSIGNED NULL,
    municipio_id         INT UNSIGNED NULL,

    -- Fiscal DIAN
    regimen_id           INT UNSIGNED NULL,     -- común/simple
    liability_id         INT UNSIGNED NULL,     -- responsable IVA / no responsable / autorretenedor...
    no_obligado_facturar TINYINT(1)   NOT NULL DEFAULT 0,

    -- Decisión operativa: cómo se soporta cada compra a este proveedor
    tipo_soporte         ENUM('fe_recibida','documento_soporte') NOT NULL DEFAULT 'fe_recibida',

    -- Impuestos aplicados al pagar (comunes en DS)
    retencion_fuente_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
    retencion_iva_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
    retencion_ica_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
    concepto_dian        VARCHAR(150) NULL,     -- ej. "Honorarios profesionales", "Servicios"

    -- Cuenta bancaria (para pagos por transferencia)
    banco_nombre         VARCHAR(100) NULL,
    banco_tipo_cuenta    ENUM('ahorros','corriente') NULL,
    banco_numero_cuenta  VARCHAR(50)  NULL,

    -- Comercial
    cupo_credito         DECIMAL(15,2) NOT NULL DEFAULT 0,
    dias_credito         SMALLINT      NOT NULL DEFAULT 0,
    observaciones        TEXT NULL,

    activo               TINYINT(1)   NOT NULL DEFAULT 1,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_empresa_identif (empresa_id, identificacion),
    KEY idx_empresa_razon (empresa_id, razon_social),
    KEY idx_empresa_activo (empresa_id, activo, tipo_soporte),
    CONSTRAINT fk_prov_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contactos de notificación (mismo patrón que clientes)
CREATE TABLE IF NOT EXISTS proveedor_contactos_notificacion (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id    INT UNSIGNED NOT NULL,
    proveedor_id  INT UNSIGNED NOT NULL,
    tipo          ENUM('pagos','contable','gerencia','entregas','otros') NOT NULL DEFAULT 'pagos',
    nombre        VARCHAR(150) NULL,
    cargo         VARCHAR(100) NULL,
    correo        VARCHAR(150) NOT NULL,
    telefono      VARCHAR(50) NULL,
    nota          VARCHAR(300) NULL,
    activo        TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_empresa_prov (empresa_id, proveedor_id),
    KEY idx_empresa_activo (empresa_id, activo),
    CONSTRAINT fk_pcn_empresa   FOREIGN KEY (empresa_id)   REFERENCES empresas(id)    ON DELETE CASCADE,
    CONSTRAINT fk_pcn_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FK productos.proveedor_id → proveedores.id
-- Sólo se agrega si no existe ya (chequeando information_schema).
-- ============================================================
SET @has_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'productos'
       AND CONSTRAINT_NAME = 'fk_prod_proveedor'
);
SET @sql := IF(@has_fk = 0,
    'ALTER TABLE productos ADD CONSTRAINT fk_prod_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL',
    'SELECT ''fk_prod_proveedor ya existe'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✓ Proveedores creados' AS resultado,
       (SELECT COUNT(*) FROM proveedores) AS proveedores_actuales;
