-- ============================================================
-- 14 · Cajas registradoras: cajas + sesiones + movimientos
--
-- Modelo portado del desktop (tblcajas / tblsesiones_caja / tblmov_caja) pero
-- MEJORADO: las ventas y pagos llevan `caja_sesion_id` (FK) para acumular por
-- sesión sin el bug de solapamiento por fecha/usuario del desktop.
--
-- empresa_config.usa_caja: si 1, no se puede vender de contado sin caja abierta.
--
-- Idempotente.
-- ============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS cajas (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id   INT UNSIGNED NOT NULL,
    nombre       VARCHAR(60) NOT NULL,
    tipo         ENUM('punto_venta','principal') NOT NULL DEFAULT 'punto_venta',
    usuario_id   INT UNSIGNED NULL,                 -- cajero asignado (opcional)
    saldo        DECIMAL(15,2) NOT NULL DEFAULT 0,  -- efectivo acumulado (sobre todo caja principal)
    activa       TINYINT(1) NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_nombre (empresa_id, nombre),
    KEY idx_empresa_activa (empresa_id, activa, tipo),
    CONSTRAINT fk_caja_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS caja_sesiones (
    id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id               INT UNSIGNED NOT NULL,
    caja_id                  INT UNSIGNED NOT NULL,
    usuario_id               INT UNSIGNED NOT NULL,
    fecha_apertura           DATETIME NOT NULL,
    fecha_cierre             DATETIME NULL,
    base_inicial             DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Acumulados persistidos al CERRAR (durante la sesión se calculan al vuelo por FK)
    ventas_contado_efectivo  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ventas_contado_transf    DECIMAL(15,2) NOT NULL DEFAULT 0,
    ventas_credito           DECIMAL(15,2) NOT NULL DEFAULT 0,
    pagos_efectivo           DECIMAL(15,2) NOT NULL DEFAULT 0,
    pagos_transf             DECIMAL(15,2) NOT NULL DEFAULT 0,
    egresos                  DECIMAL(15,2) NOT NULL DEFAULT 0,
    anulaciones              DECIMAL(15,2) NOT NULL DEFAULT 0,
    retiros_parciales        DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_efectivo_sistema   DECIMAL(15,2) NOT NULL DEFAULT 0,
    conteo_final             DECIMAL(15,2) NOT NULL DEFAULT 0,
    diferencia_final         DECIMAL(15,2) NOT NULL DEFAULT 0,
    estado                   ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
    observacion              VARCHAR(255) NULL,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_empresa_caja_estado (empresa_id, caja_id, estado),
    KEY idx_empresa_estado (empresa_id, estado),
    CONSTRAINT fk_sesion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_sesion_caja FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS caja_movimientos (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id       INT UNSIGNED NOT NULL,
    caja_sesion_id   INT UNSIGNED NULL,
    caja_origen_id   INT UNSIGNED NULL,
    caja_destino_id  INT UNSIGNED NULL,
    usuario_id       INT UNSIGNED NOT NULL,
    fecha            DATETIME NOT NULL,
    valor            DECIMAL(15,2) NOT NULL,
    tipo             ENUM('retiro_parcial','traslado','deposito','gasto') NOT NULL,
    descripcion      VARCHAR(255) NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_empresa_sesion (empresa_id, caja_sesion_id),
    KEY idx_empresa_fecha (empresa_id, fecha),
    CONSTRAINT fk_mov_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vínculo de ventas y pagos a la sesión de caja (acumular por FK)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS caja_sesion_id INT UNSIGNED NULL AFTER usuario_id;
ALTER TABLE ventas ADD KEY IF NOT EXISTS idx_caja_sesion (empresa_id, caja_sesion_id);
ALTER TABLE pagos  ADD COLUMN IF NOT EXISTS caja_sesion_id INT UNSIGNED NULL AFTER usuario_id;
ALTER TABLE pagos  ADD KEY IF NOT EXISTS idx_caja_sesion (empresa_id, caja_sesion_id);

-- Flag: la caja es obligatoria para vender de contado
ALTER TABLE empresa_config ADD COLUMN IF NOT EXISTS usa_caja TINYINT(1) NOT NULL DEFAULT 0 AFTER usa_fe;

SELECT '✓ cajas + sesiones + movimientos creadas' AS resultado;
