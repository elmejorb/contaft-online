-- ==============================================================
-- Conta FT Online — Schema del LANDLORD
-- BD: u408713046_dbcontaft (Hostinger MariaDB 11.8)
--
-- Contiene todo lo transversal al SaaS: empresas registradas,
-- usuarios, planes, suscripciones, audit trail.
--
-- Idempotente — se puede correr varias veces sin romper nada.
-- ==============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------
-- planes
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre              VARCHAR(60)   NOT NULL,
    slug                VARCHAR(60)   NOT NULL UNIQUE,
    precio_mensual      DECIMAL(15,2) NOT NULL DEFAULT 0,
    max_empresas        INT           NOT NULL DEFAULT 1,
    max_ventas_mes      INT           NULL,           -- NULL = ilimitado
    max_usuarios        INT           NOT NULL DEFAULT 3,
    max_productos       INT           NULL,           -- NULL = ilimitado
    features            JSON          NULL,           -- flags: {"fe_dian": true, "kardex": true, ...}
    activo              TINYINT(1)    NOT NULL DEFAULT 1,
    orden               INT           NOT NULL DEFAULT 0,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_activo (activo, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Planes iniciales (INSERT idempotente vía slug)
INSERT INTO planes (nombre, slug, precio_mensual, max_empresas, max_ventas_mes, max_usuarios, features, orden)
VALUES
  ('Prueba', 'trial', 0.00, 1, 30, 1,
   JSON_OBJECT('fe_dian', true, 'kardex', true, 'informes_basicos', true, 'trial_dias', 14), 0),
  ('Básico', 'basico', 49900.00, 1, 200, 3,
   JSON_OBJECT('fe_dian', true, 'kardex', true, 'informes_basicos', true), 1),
  ('Pro', 'pro', 89900.00, 1, 1000, 8,
   JSON_OBJECT('fe_dian', true, 'kardex', true, 'informes_basicos', true, 'informes_pro', true, 'multi_caja', true, 'vendedores_movil', true), 2),
  ('Empresarial', 'empresarial', 149900.00, 5, NULL, 30,
   JSON_OBJECT('fe_dian', true, 'kardex', true, 'informes_basicos', true, 'informes_pro', true, 'multi_caja', true, 'vendedores_movil', true, 'api_publica', true, 'multi_empresa', true), 3)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), updated_at = NOW();

-- --------------------------------------------------------------
-- empresas
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
    id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    razon_social           VARCHAR(200)  NOT NULL,
    nit                    VARCHAR(20)   NOT NULL,
    dv                     VARCHAR(2)    NULL,
    email_contacto         VARCHAR(150)  NOT NULL,
    telefono               VARCHAR(50)   NULL,
    direccion              VARCHAR(200)  NULL,
    municipio_id           INT           NULL,        -- FK a catálogo DIAN (municipios en landlord o tenant)
    tipo_organizacion_id   INT           NULL,        -- 1=Jurídica, 2=Natural
    tipo_regimen_id        INT           NULL,        -- Común / Simplificado / Simple / No Responsable
    tipo_documento_id      INT           NULL,        -- NIT / CC / CE
    bd_name                VARCHAR(64)   NOT NULL UNIQUE,  -- ej. u408713046_cli_ammi
    plan_id                INT UNSIGNED  NOT NULL,
    trial_hasta            DATE          NULL,
    suscripcion_hasta      DATE          NULL,
    activa                 TINYINT(1)    NOT NULL DEFAULT 1,
    suspendida_motivo      VARCHAR(255)  NULL,
    logo_url               VARCHAR(500)  NULL,
    api_electronica_id     INT           NULL,        -- id de la empresa en api-electronica (para eventos DIAN)
    api_electronica_email  VARCHAR(150)  NULL,        -- credenciales de login a api-electronica
    api_electronica_pass   VARCHAR(255)  NULL,        -- (cifrada — Laravel Crypt)
    created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_nit (nit),
    KEY idx_activa (activa),
    KEY idx_plan (plan_id),
    CONSTRAINT fk_empresas_plan FOREIGN KEY (plan_id) REFERENCES planes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- usuarios
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email                VARCHAR(150)  NOT NULL UNIQUE,
    password_hash        VARCHAR(255)  NOT NULL,
    nombre               VARCHAR(150)  NOT NULL,
    telefono             VARCHAR(50)   NULL,
    email_verificado_at  TIMESTAMP     NULL,
    ultimo_login_at      TIMESTAMP     NULL,
    ultimo_ip            VARCHAR(45)   NULL,
    activo               TINYINT(1)    NOT NULL DEFAULT 1,
    remember_token       VARCHAR(100)  NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_email (email, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- usuarios_empresas (relación M:N con rol)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_empresas (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id        INT UNSIGNED  NOT NULL,
    empresa_id        INT UNSIGNED  NOT NULL,
    rol               ENUM('admin','contador','vendedor','bodega','solo_lectura') NOT NULL,
    empresa_default   TINYINT(1)    NOT NULL DEFAULT 0,
    activo            TINYINT(1)    NOT NULL DEFAULT 1,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_empresa (usuario_id, empresa_id),
    KEY idx_empresa (empresa_id, activo),
    CONSTRAINT fk_ue_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_ue_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- personal_access_tokens (Laravel Sanctum — schema oficial)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id   BIGINT UNSIGNED NOT NULL,
    name           VARCHAR(255) NOT NULL,
    token          VARCHAR(64)  NOT NULL UNIQUE,
    abilities      TEXT NULL,
    last_used_at   TIMESTAMP NULL,
    expires_at     TIMESTAMP NULL,
    created_at     TIMESTAMP NULL,
    updated_at     TIMESTAMP NULL,
    KEY idx_tokenable (tokenable_type, tokenable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- subscripciones
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscripciones (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id     INT UNSIGNED  NOT NULL,
    plan_id        INT UNSIGNED  NOT NULL,
    inicio         DATE          NOT NULL,
    fin            DATE          NOT NULL,
    monto          DECIMAL(15,2) NOT NULL,
    estado         ENUM('activa','vencida','cancelada','morosa') NOT NULL DEFAULT 'activa',
    metodo_pago    VARCHAR(50)   NULL,
    pasarela       VARCHAR(50)   NULL,          -- wompi, mercadopago, manual, etc.
    pasarela_ref   VARCHAR(200)  NULL,          -- transaction id
    notas          TEXT          NULL,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_empresa_estado (empresa_id, estado),
    KEY idx_fin (fin),
    CONSTRAINT fk_sub_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan    FOREIGN KEY (plan_id)    REFERENCES planes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- facturas_saas (lo que Innovacion Digital le cobra al cliente)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas_saas (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id        INT UNSIGNED  NOT NULL,
    subscripcion_id   INT UNSIGNED  NOT NULL,
    numero            VARCHAR(20)   NOT NULL UNIQUE,
    fecha             DATE          NOT NULL,
    fecha_vencimiento DATE          NOT NULL,
    monto             DECIMAL(15,2) NOT NULL,
    estado            ENUM('pendiente','paga','vencida','anulada') NOT NULL DEFAULT 'pendiente',
    pagada_at         TIMESTAMP     NULL,
    pdf_path          VARCHAR(500)  NULL,
    cufe              VARCHAR(96)   NULL,        -- si emitimos FE al cliente
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_empresa (empresa_id, estado),
    KEY idx_vencimiento (fecha_vencimiento, estado),
    CONSTRAINT fk_fs_empresa      FOREIGN KEY (empresa_id)      REFERENCES empresas(id),
    CONSTRAINT fk_fs_subscripcion FOREIGN KEY (subscripcion_id) REFERENCES subscripciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- audit_log — trazabilidad de acciones críticas del SaaS
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT UNSIGNED  NULL,
    empresa_id   INT UNSIGNED  NULL,
    accion       VARCHAR(80)   NOT NULL,   -- signup, login, plan_change, suspend, delete_tenant_db, ...
    detalles     JSON          NULL,
    ip           VARCHAR(45)   NULL,
    user_agent   VARCHAR(500)  NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_usuario (usuario_id, created_at),
    KEY idx_empresa (empresa_id, created_at),
    KEY idx_accion  (accion, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------
-- migraciones_tenant — control de versión del schema por tenant
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migraciones_tenant (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id    INT UNSIGNED  NOT NULL,
    version       VARCHAR(20)   NOT NULL,
    ejecutada_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultado     ENUM('ok','error') NOT NULL DEFAULT 'ok',
    error_msg     TEXT          NULL,
    UNIQUE KEY uq_empresa_version (empresa_id, version),
    CONSTRAINT fk_mt_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================
-- Verificación final
-- ==============================================================
SELECT '✓ Landlord schema aplicado' AS resultado;
SELECT COUNT(*) AS total_planes FROM planes;
SELECT COUNT(*) AS total_tablas
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('planes','empresas','usuarios','usuarios_empresas',
                     'personal_access_tokens','subscripciones',
                     'facturas_saas','audit_log','migraciones_tenant');
