-- ==============================================================
-- Conta FT Online — Tablas de TENANT (row-level multi-tenant)
--
-- Estas tablas viven en la MISMA BD que el landlord
-- (u408713046_dbcontaft). Cada fila lleva `empresa_id` que apunta a
-- landlord.empresas.id → aislamiento por scope global en Eloquent.
--
-- MVP incluye lo esencial para las Fases 1-3:
--   * empresa_config
--   * clientes, productos, familias, kardex
--   * ventas, venta_lineas, venta_retenciones
--   * pagos, medios_pago, retenciones
--   * vw_facturas_saldo  (con fix descuento desde diseño)
--
-- REGLA CRÍTICA: cada tabla tenant tiene:
--   - Columna `empresa_id INT UNSIGNED NOT NULL`
--   - FK a `empresas(id) ON DELETE CASCADE`
--   - Índice compuesto que empieza por `empresa_id`
--
-- Idempotente — se puede correr varias veces sin romper.
-- ==============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================
-- CONFIGURACIÓN OPERATIVA DE CADA EMPRESA (1 fila por empresa)
-- ==============================================================
CREATE TABLE IF NOT EXISTS empresa_config (
    id                              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id                      INT UNSIGNED NOT NULL,
    iva_incluido                    TINYINT(1) NOT NULL DEFAULT 1,
    resolucion_fe                   VARCHAR(30)  NULL,
    resolucion_fecha                DATE         NULL,
    prefijo_fe                      VARCHAR(4)   NULL,
    rango_desde                     INT          NULL,
    rango_hasta                     INT          NULL,
    iniciar_factura_en              INT          NOT NULL DEFAULT 1,
    moneda                          VARCHAR(3)   NOT NULL DEFAULT 'COP',
    agente_retenedor                TINYINT(1)   NOT NULL DEFAULT 0,
    autorizar_devoluciones          TINYINT(1)   NOT NULL DEFAULT 1,
    autorizar_anulaciones           TINYINT(1)   NOT NULL DEFAULT 1,
    permitir_facturar_negativo      TINYINT(1)   NOT NULL DEFAULT 0,
    usar_familias                   TINYINT(1)   NOT NULL DEFAULT 0,
    usar_lotes                      TINYINT(1)   NOT NULL DEFAULT 0,
    imprimir_cotizacion             TINYINT(1)   NOT NULL DEFAULT 1,
    logo_path                       VARCHAR(500) NULL,
    representante_tipo_doc_id       INT          NULL,
    representante_numero            VARCHAR(30)  NULL,
    representante_dv                VARCHAR(2)   NULL,
    representante_primer_nombre     VARCHAR(60)  NULL,
    representante_segundo_nombre    VARCHAR(60)  NULL,
    representante_primer_apellido   VARCHAR(60)  NULL,
    representante_segundo_apellido  VARCHAR(60)  NULL,
    representante_cargo             VARCHAR(80)  NOT NULL DEFAULT 'Representante Legal',
    representante_area              VARCHAR(80)  NOT NULL DEFAULT 'Administración',
    created_at                      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa (empresa_id),
    CONSTRAINT fk_econfig_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- CATÁLOGOS COMPARTIDOS (globales — sin empresa_id)
-- ==============================================================
CREATE TABLE IF NOT EXISTS medios_pago (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(60) NOT NULL UNIQUE,
    tipo       ENUM('efectivo','tarjeta','transferencia','cheque','otro') NOT NULL,
    orden      INT NOT NULL DEFAULT 0,
    activo     TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO medios_pago (nombre, tipo, orden) VALUES
    ('Efectivo',      'efectivo',      1),
    ('Tarjeta',       'tarjeta',       2),
    ('Bancolombia',   'transferencia', 3),
    ('Nequi',         'transferencia', 4),
    ('Daviplata',     'transferencia', 5),
    ('Cheque',        'cheque',        6)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Retenciones: cada empresa configura las suyas
CREATE TABLE IF NOT EXISTS retenciones (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id    INT UNSIGNED NOT NULL,
    codigo        VARCHAR(20) NOT NULL,
    nombre        VARCHAR(100) NOT NULL,
    codigo_dian   VARCHAR(4)  NULL,
    porcentaje    DECIMAL(6,3) NOT NULL,
    base_desde    DECIMAL(15,2) NOT NULL DEFAULT 0,
    tipo_calculo  ENUM('sobre_base','gross_up') NOT NULL DEFAULT 'sobre_base',
    activo        TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_codigo (empresa_id, codigo),
    CONSTRAINT fk_ret_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- PERSONAS
-- ==============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id            INT UNSIGNED NOT NULL,
    codigo                VARCHAR(20) NULL,
    razon_social          VARCHAR(200) NOT NULL,
    tipo_persona          ENUM('natural','juridica') NOT NULL DEFAULT 'natural',
    tipo_documento_id     INT NULL,
    identificacion        VARCHAR(30) NOT NULL,
    dv                    VARCHAR(2) NULL,
    nombre_comercial      VARCHAR(200) NULL,
    email                 VARCHAR(150) NULL,
    telefono              VARCHAR(50) NULL,
    whatsapp              VARCHAR(50) NULL,
    direccion             VARCHAR(200) NULL,
    municipio_id          INT NULL,
    regimen_id            INT NULL,
    liability_id          INT NULL,
    cupo_credito          DECIMAL(15,2) NOT NULL DEFAULT 0,
    dias_credito          INT NOT NULL DEFAULT 0,
    fecha_cumpleanos      DATE NULL,
    observaciones         TEXT NULL,
    retenciones           JSON NULL,
    activo                TINYINT(1) NOT NULL DEFAULT 1,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_identificacion (empresa_id, identificacion),
    KEY idx_empresa_razon (empresa_id, razon_social),
    KEY idx_empresa_activo (empresa_id, activo),
    CONSTRAINT fk_cli_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendedores (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id     INT UNSIGNED NOT NULL,
    usuario_id     INT UNSIGNED NULL,
    nombre         VARCHAR(150) NOT NULL,
    telefono       VARCHAR(50) NULL,
    comision_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
    zona           VARCHAR(100) NULL,
    activo         TINYINT(1) NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_empresa (empresa_id, activo),
    CONSTRAINT fk_vend_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- INVENTARIO
-- ==============================================================
CREATE TABLE IF NOT EXISTS familias (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT UNSIGNED NOT NULL,
    codigo     VARCHAR(20) NULL,
    nombre     VARCHAR(100) NOT NULL,
    padre_id   INT UNSIGNED NULL,
    orden      INT NOT NULL DEFAULT 0,
    activo     TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_empresa (empresa_id, activo),
    KEY idx_padre (padre_id),
    CONSTRAINT fk_fam_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS productos (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id           INT UNSIGNED NOT NULL,
    codigo               VARCHAR(30) NOT NULL,
    codigo_barras        VARCHAR(50) NULL,
    nombre               VARCHAR(200) NOT NULL,
    descripcion          TEXT NULL,
    familia_id           INT UNSIGNED NULL,
    unidad_medida_id     INT NULL,
    es_servicio          TINYINT(1) NOT NULL DEFAULT 0,
    tiene_componentes    TINYINT(1) NOT NULL DEFAULT 0,
    tiene_lotes          TINYINT(1) NOT NULL DEFAULT 0,
    precio_costo         DECIMAL(15,4) NOT NULL DEFAULT 0,
    precio_venta_1       DECIMAL(15,4) NOT NULL DEFAULT 0,
    precio_venta_2       DECIMAL(15,4) NOT NULL DEFAULT 0,
    precio_venta_3       DECIMAL(15,4) NOT NULL DEFAULT 0,
    iva_pct              DECIMAL(5,2) NOT NULL DEFAULT 19,
    existencia           DECIMAL(15,3) NOT NULL DEFAULT 0,
    existencia_minima    DECIMAL(15,3) NOT NULL DEFAULT 0,
    ubicacion            VARCHAR(50) NULL,
    proveedor_id         INT UNSIGNED NULL,
    imagen_path          VARCHAR(500) NULL,
    notas                TEXT NULL,
    activo               TINYINT(1) NOT NULL DEFAULT 1,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_codigo (empresa_id, codigo),
    KEY idx_empresa_familia (empresa_id, familia_id),
    KEY idx_empresa_barras (empresa_id, codigo_barras),
    KEY idx_empresa_nombre (empresa_id, nombre),
    KEY idx_empresa_activo (empresa_id, activo, es_servicio),
    CONSTRAINT fk_prod_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS producto_componentes (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id    INT UNSIGNED NOT NULL,
    padre_id      INT UNSIGNED NOT NULL,
    componente_id INT UNSIGNED NOT NULL,
    cantidad      DECIMAL(15,3) NOT NULL,
    KEY idx_empresa_padre (empresa_id, padre_id),
    CONSTRAINT fk_pc_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS producto_lotes (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id         INT UNSIGNED NOT NULL,
    producto_id        INT UNSIGNED NOT NULL,
    codigo_lote        VARCHAR(50) NOT NULL,
    fecha_vencimiento  DATE NULL,
    existencia         DECIMAL(15,3) NOT NULL DEFAULT 0,
    precio_costo       DECIMAL(15,4) NOT NULL DEFAULT 0,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_empresa_producto_venc (empresa_id, producto_id, fecha_vencimiento),
    CONSTRAINT fk_lote_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kardex INMUTABLE
CREATE TABLE IF NOT EXISTS kardex (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id        INT UNSIGNED NOT NULL,
    fecha             DATETIME NOT NULL,
    producto_id       INT UNSIGNED NOT NULL,
    tipo              ENUM('entrada','salida','ajuste','reverso','anulacion') NOT NULL,
    concepto          VARCHAR(200) NOT NULL,
    referencia_tipo   VARCHAR(30) NULL,
    referencia_id     INT UNSIGNED NULL,
    cantidad_entrada  DECIMAL(15,3) NOT NULL DEFAULT 0,
    cantidad_salida   DECIMAL(15,3) NOT NULL DEFAULT 0,
    costo_unitario    DECIMAL(15,4) NOT NULL DEFAULT 0,
    costo_movimiento  DECIMAL(15,2) NOT NULL DEFAULT 0,
    saldo_cantidad    DECIMAL(15,3) NOT NULL DEFAULT 0,
    saldo_costo       DECIMAL(15,2) NOT NULL DEFAULT 0,
    usuario_id        INT UNSIGNED NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_empresa_producto_fecha (empresa_id, producto_id, fecha),
    KEY idx_empresa_ref (empresa_id, referencia_tipo, referencia_id),
    CONSTRAINT fk_kdx_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- VENTAS + FE
-- ==============================================================
CREATE TABLE IF NOT EXISTS ventas (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id            INT UNSIGNED NOT NULL,
    numero                INT NOT NULL,
    tipo_documento        ENUM('pos','electronica','soporte','cotizacion') NOT NULL DEFAULT 'pos',
    tipo_termino          ENUM('contado','credito') NOT NULL DEFAULT 'contado',
    dias_credito          INT NOT NULL DEFAULT 0,
    fecha                 DATETIME NOT NULL,
    cliente_id            INT UNSIGNED NOT NULL,
    vendedor_id           INT UNSIGNED NULL,
    lista_precio          TINYINT NOT NULL DEFAULT 1,
    descuento_global      DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal              DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_iva             DECIMAL(15,2) NOT NULL DEFAULT 0,
    total                 DECIMAL(15,2) NOT NULL DEFAULT 0,
    comentario            TEXT NULL,
    medio_pago_id         INT UNSIGNED NULL,
    efectivo              DECIMAL(15,2) NOT NULL DEFAULT 0,
    transferencia         DECIMAL(15,2) NOT NULL DEFAULT 0,
    cambio                DECIMAL(15,2) NOT NULL DEFAULT 0,
    abono_inicial         DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_form_id       INT NULL,
    payment_method_id     INT NULL,
    payment_due_days      INT NULL,
    prefijo_fe            VARCHAR(4) NULL,
    numero_fe             BIGINT NULL,
    cufe                  VARCHAR(96) NULL,
    cufe_url_qr           VARCHAR(500) NULL,
    dian_estado           ENUM('borrador','pendiente','enviado','autorizado','rechazado','anulado') NULL,
    dian_response         LONGTEXT NULL,
    enviada_dian_at       DATETIME NULL,
    email_enviado         TINYINT(1) NOT NULL DEFAULT 0,
    email_enviado_at      DATETIME NULL,
    estado                ENUM('valida','anulada','borrador') NOT NULL DEFAULT 'valida',
    anulada_at            DATETIME NULL,
    anulada_por           INT UNSIGNED NULL,
    anulada_motivo        VARCHAR(500) NULL,
    usuario_id            INT UNSIGNED NOT NULL,
    autorizado_por        INT UNSIGNED NULL,
    en_contingencia       TINYINT(1) NOT NULL DEFAULT 0,
    contingencia_motivo   VARCHAR(255) NULL,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_numero (empresa_id, numero),
    UNIQUE KEY uq_cufe (cufe),
    KEY idx_empresa_fecha (empresa_id, fecha),
    KEY idx_empresa_cliente (empresa_id, cliente_id),
    KEY idx_empresa_estado (empresa_id, estado, dian_estado),
    KEY idx_empresa_tipo (empresa_id, tipo_documento, tipo_termino, estado),
    CONSTRAINT fk_venta_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS venta_lineas (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id            INT UNSIGNED NOT NULL,
    venta_id              INT UNSIGNED NOT NULL,
    linea_num             INT NOT NULL,
    producto_id           INT UNSIGNED NOT NULL,
    descripcion_temp      VARCHAR(300) NULL,
    cantidad              DECIMAL(15,3) NOT NULL,
    precio_costo          DECIMAL(15,4) NOT NULL DEFAULT 0,
    precio_venta          DECIMAL(15,4) NOT NULL,
    iva_pct               DECIMAL(5,2) NOT NULL DEFAULT 0,
    iva_monto             DECIMAL(15,2) NOT NULL DEFAULT 0,
    descuento_monto       DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal              DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_linea           DECIMAL(15,2) NOT NULL DEFAULT 0,
    KEY idx_empresa_venta (empresa_id, venta_id),
    KEY idx_producto (producto_id),
    CONSTRAINT fk_vl_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    CONSTRAINT fk_vl_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS venta_retenciones (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id     INT UNSIGNED NOT NULL,
    venta_id       INT UNSIGNED NOT NULL,
    retencion_id   INT UNSIGNED NOT NULL,
    porcentaje     DECIMAL(6,3) NOT NULL,
    base           DECIMAL(15,2) NOT NULL,
    valor          DECIMAL(15,2) NOT NULL,
    modo           ENUM('inf','gross_up') NOT NULL DEFAULT 'inf',
    KEY idx_empresa_venta (empresa_id, venta_id),
    CONSTRAINT fk_vr_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    CONSTRAINT fk_vr_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- PAGOS
-- ==============================================================
CREATE TABLE IF NOT EXISTS pagos (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id     INT UNSIGNED NOT NULL,
    consecutivo    INT NOT NULL,
    fecha          DATETIME NOT NULL,
    cliente_id     INT UNSIGNED NOT NULL,
    venta_id       INT UNSIGNED NOT NULL,
    medio_pago_id  INT UNSIGNED NOT NULL,
    valor          DECIMAL(15,2) NOT NULL,
    descuento      DECIMAL(15,2) NOT NULL DEFAULT 0,
    retencion      DECIMAL(15,2) NOT NULL DEFAULT 0,
    detalle        VARCHAR(300) NULL,
    usuario_id     INT UNSIGNED NOT NULL,
    estado         ENUM('valida','anulada') NOT NULL DEFAULT 'valida',
    anulado_at     DATETIME NULL,
    anulado_por    INT UNSIGNED NULL,
    anulado_motivo VARCHAR(500) NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_empresa_consecutivo (empresa_id, consecutivo),
    KEY idx_empresa_cliente_venta (empresa_id, cliente_id, venta_id),
    KEY idx_empresa_fecha (empresa_id, fecha),
    KEY idx_empresa_estado (empresa_id, estado),
    CONSTRAINT fk_pago_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================
-- VISTAS DE CARTERA — fix descuento desde diseño
-- ==============================================================
DROP VIEW IF EXISTS vw_facturas_saldo;
CREATE VIEW vw_facturas_saldo AS
SELECT
    v.id                                              AS venta_id,
    v.empresa_id,
    v.numero,
    v.cliente_id,
    v.fecha,
    v.dias_credito,
    DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY)    AS fecha_vencimiento,
    v.total,
    COALESCE(p.total_pagado, 0)                        AS total_pagado,
    GREATEST(v.total - COALESCE(p.total_pagado, 0), 0) AS saldo,
    CASE
      WHEN CURDATE() > DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY)
        THEN DATEDIFF(CURDATE(), DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY))
      ELSE 0
    END                                              AS dias_vencido,
    CURDATE() > DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY) AS vencida
FROM ventas v
LEFT JOIN (
    SELECT empresa_id, venta_id,
           SUM(valor + COALESCE(descuento, 0)) AS total_pagado
    FROM pagos
    WHERE estado = 'valida'
      AND valor >= 0
      AND COALESCE(descuento, 0) >= 0
    GROUP BY empresa_id, venta_id
) p ON p.venta_id = v.id AND p.empresa_id = v.empresa_id
WHERE v.tipo_termino = 'credito'
  AND v.estado = 'valida'
  AND v.tipo_documento IN ('pos','electronica','soporte');

DROP VIEW IF EXISTS vw_cartera_cliente;
CREATE VIEW vw_cartera_cliente AS
SELECT
    c.id                              AS cliente_id,
    c.empresa_id,
    c.razon_social,
    c.identificacion,
    c.cupo_credito,
    COUNT(vfs.venta_id)               AS facturas_pendientes,
    COALESCE(SUM(vfs.saldo), 0)       AS saldo_total,
    COALESCE(SUM(CASE WHEN vfs.vencida = 1 THEN vfs.saldo ELSE 0 END), 0) AS saldo_vencido,
    MAX(vfs.dias_vencido)             AS max_dias_vencido
FROM clientes c
LEFT JOIN vw_facturas_saldo vfs
       ON vfs.cliente_id = c.id
      AND vfs.empresa_id = c.empresa_id
      AND vfs.saldo > 0
WHERE c.activo = 1
GROUP BY c.id, c.empresa_id;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '✓ Tenant tables aplicadas' AS resultado;
SELECT COUNT(*) AS total_tablas_tenant
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('empresa_config','medios_pago','retenciones','clientes',
                     'vendedores','familias','productos','producto_componentes',
                     'producto_lotes','kardex','ventas','venta_lineas',
                     'venta_retenciones','pagos');
