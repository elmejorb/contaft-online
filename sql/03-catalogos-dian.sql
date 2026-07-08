-- ==============================================================
-- Conta FT Online — Catálogos DIAN
--
-- Tablas de referencia globales (sin empresa_id, iguales para todos
-- los tenants). Se aplican una vez al setup del landlord y se van
-- actualizando si DIAN publica cambios.
--
-- Fuente: Resolución 000042 DIAN y anexos técnicos v1.9.
-- Idempotente (INSERT ... ON DUPLICATE KEY UPDATE).
-- ==============================================================
SET NAMES utf8mb4;

-- ---------- 1. Tipos de documento de identificación ----------
CREATE TABLE IF NOT EXISTS dian_tipos_documento (
    id       INT UNSIGNED PRIMARY KEY,
    codigo   VARCHAR(4) NOT NULL,
    nombre   VARCHAR(80) NOT NULL,
    orden    INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_tipos_documento (id, codigo, nombre, orden) VALUES
    (1,  '11', 'Registro Civil',                    1),
    (2,  '12', 'Tarjeta de Identidad',              2),
    (3,  '13', 'Cédula de Ciudadanía',              3),
    (4,  '21', 'Tarjeta de Extranjería',            4),
    (5,  '22', 'Cédula de Extranjería',             5),
    (6,  '31', 'NIT',                               6),
    (7,  '41', 'Pasaporte',                         7),
    (8,  '42', 'Documento de identificación extranjero', 8),
    (9,  '47', 'PEP (Permiso Especial de Permanencia)',  9),
    (10, '50', 'NIT de otro país',                       10),
    (11, '91', 'NUIP',                                   11)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 2. Tipos de organización ----------
CREATE TABLE IF NOT EXISTS dian_tipos_organizacion (
    id     INT UNSIGNED PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    nombre VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_tipos_organizacion (id, codigo, nombre) VALUES
    (1, '1', 'Persona Jurídica'),
    (2, '2', 'Persona Natural')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 3. Responsabilidades tributarias (type_liability) ----------
CREATE TABLE IF NOT EXISTS dian_tipos_responsabilidad (
    id     INT UNSIGNED PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    orden  INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_tipos_responsabilidad (id, codigo, nombre, orden) VALUES
    (1,  'O-13',   'Gran contribuyente',                         1),
    (2,  'O-15',   'Autorretenedor',                             2),
    (3,  'O-23',   'Agente de retención IVA',                    3),
    (4,  'O-47',   'Régimen simple de tributación',              4),
    (5,  'R-99-PN','No responsable',                             5)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 4. Régimen (type_regime) ----------
CREATE TABLE IF NOT EXISTS dian_tipos_regimen (
    id     INT UNSIGNED PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    nombre VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_tipos_regimen (id, codigo, nombre) VALUES
    (1, '48', 'Responsable de IVA'),
    (2, '49', 'No responsable de IVA')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 5. Tipo de adquirente / operación de venta ----------
CREATE TABLE IF NOT EXISTS dian_tipos_adquirente (
    id     INT UNSIGNED PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_tipos_adquirente (id, codigo, nombre, descripcion) VALUES
    (1, '01', 'Estándar',   'Operación normal de venta'),
    (2, '10', 'AIU',        'Administración, Imprevistos y Utilidad'),
    (3, '11', 'Mandatos',   'Facturación por cuenta de un tercero')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 6. Departamentos (33 de Colombia) ----------
CREATE TABLE IF NOT EXISTS dian_departamentos (
    id     INT UNSIGNED PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    KEY idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dian_departamentos (id, codigo, nombre) VALUES
    (1,  '05', 'Antioquia'),
    (2,  '08', 'Atlántico'),
    (3,  '11', 'Bogotá D.C.'),
    (4,  '13', 'Bolívar'),
    (5,  '15', 'Boyacá'),
    (6,  '17', 'Caldas'),
    (7,  '18', 'Caquetá'),
    (8,  '19', 'Cauca'),
    (9,  '20', 'Cesar'),
    (10, '23', 'Córdoba'),
    (11, '25', 'Cundinamarca'),
    (12, '27', 'Chocó'),
    (13, '41', 'Huila'),
    (14, '44', 'La Guajira'),
    (15, '47', 'Magdalena'),
    (16, '50', 'Meta'),
    (17, '52', 'Nariño'),
    (18, '54', 'Norte de Santander'),
    (19, '63', 'Quindío'),
    (20, '66', 'Risaralda'),
    (21, '68', 'Santander'),
    (22, '70', 'Sucre'),
    (23, '73', 'Tolima'),
    (24, '76', 'Valle del Cauca'),
    (25, '81', 'Arauca'),
    (26, '85', 'Casanare'),
    (27, '86', 'Putumayo'),
    (28, '88', 'San Andrés y Providencia'),
    (29, '91', 'Amazonas'),
    (30, '94', 'Guainía'),
    (31, '95', 'Guaviare'),
    (32, '97', 'Vaupés'),
    (33, '99', 'Vichada')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------- 7. Municipios (subset — se completa desde api-electronica al hacer signup) ----------
CREATE TABLE IF NOT EXISTS dian_municipios (
    id             INT UNSIGNED PRIMARY KEY,
    departamento_id INT UNSIGNED NOT NULL,
    codigo         VARCHAR(6) NOT NULL,
    nombre         VARCHAR(120) NOT NULL,
    KEY idx_departamento (departamento_id),
    KEY idx_nombre (nombre),
    CONSTRAINT fk_muni_dept FOREIGN KEY (departamento_id) REFERENCES dian_departamentos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Muestra representativa. En producción se pueden importar los ~1122 municipios
-- desde el catálogo de la DIAN (viene con la api-electronica).
INSERT INTO dian_municipios (id, departamento_id, codigo, nombre) VALUES
    -- Bogotá
    (1,   3,  '11001', 'Bogotá D.C.'),
    -- Antioquia
    (2,   1,  '05001', 'Medellín'),
    (3,   1,  '05088', 'Bello'),
    (4,   1,  '05360', 'Itagüí'),
    (5,   1,  '05266', 'Envigado'),
    -- Atlántico
    (6,   2,  '08001', 'Barranquilla'),
    (7,   2,  '08758', 'Soledad'),
    -- Bolívar
    (8,   4,  '13001', 'Cartagena'),
    -- Valle
    (9,  24,  '76001', 'Cali'),
    (10, 24,  '76520', 'Palmira'),
    -- Cundinamarca
    (11, 11,  '25754', 'Soacha'),
    (12, 11,  '25286', 'Funza'),
    -- Santander
    (13, 21,  '68001', 'Bucaramanga'),
    -- Norte de Santander
    (14, 18,  '54001', 'Cúcuta'),
    -- Córdoba
    (15, 10,  '23001', 'Montería'),
    (16, 10,  '23555', 'Planeta Rica'),
    (17, 10,  '23417', 'Lorica'),
    -- Caldas
    (18,  6,  '17001', 'Manizales'),
    -- Risaralda
    (19, 20,  '66001', 'Pereira'),
    -- Quindío
    (20, 19,  '63001', 'Armenia'),
    -- Tolima
    (21, 23,  '73001', 'Ibagué'),
    -- Huila
    (22, 13,  '41001', 'Neiva'),
    -- Nariño
    (23, 17,  '52001', 'Pasto'),
    -- Cauca
    (24,  8,  '19001', 'Popayán'),
    -- Cesar
    (25,  9,  '20001', 'Valledupar'),
    -- Magdalena
    (26, 15,  '47001', 'Santa Marta'),
    -- La Guajira
    (27, 14,  '44001', 'Riohacha'),
    -- Meta
    (28, 16,  '50001', 'Villavicencio'),
    -- Casanare
    (29, 26,  '85001', 'Yopal'),
    -- Boyacá
    (30,  5,  '15001', 'Tunja')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ==============================================================
-- Extensiones a `clientes` — datos DIAN adicionales
-- ==============================================================

-- Tipo de adquirente (idempotente vía SHOW COLUMNS)
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'tipo_adquirente_id');
SET @sql := IF(@has_col = 0,
    'ALTER TABLE clientes ADD COLUMN tipo_adquirente_id INT UNSIGNED NULL AFTER liability_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Matrícula mercantil (opcional, para personas jurídicas)
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'matricula_mercantil');
SET @sql := IF(@has_col = 0,
    'ALTER TABLE clientes ADD COLUMN matricula_mercantil VARCHAR(30) NULL AFTER dv',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Departamento (cache del municipio, evita el JOIN en cada listado)
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'departamento_id');
SET @sql := IF(@has_col = 0,
    'ALTER TABLE clientes ADD COLUMN departamento_id INT UNSIGNED NULL AFTER direccion',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==============================================================
-- cliente_contactos_notificacion
-- Emails Cc que reciben copia cuando se envía la factura por correo.
-- No aparecen en el PDF impreso ni en el XML DIAN — son solo para el
-- envío de email de cortesía (contadores, gerentes, contabilidad).
-- ==============================================================
CREATE TABLE IF NOT EXISTS cliente_contactos_notificacion (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    empresa_id   INT UNSIGNED NOT NULL,
    cliente_id   INT UNSIGNED NOT NULL,
    tipo         ENUM('entrega','contable','pagos','gerencia','otros') NOT NULL DEFAULT 'entrega',
    nombre       VARCHAR(150) NULL,
    cargo        VARCHAR(100) NULL,
    correo       VARCHAR(150) NOT NULL,
    telefono     VARCHAR(50) NULL,
    nota         VARCHAR(300) NULL,
    activo       TINYINT(1) NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_empresa_cliente (empresa_id, cliente_id),
    KEY idx_empresa_activo (empresa_id, activo),
    CONSTRAINT fk_ccn_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_ccn_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verificación
SELECT '✓ Catálogos DIAN aplicados' AS resultado;
SELECT (SELECT COUNT(*) FROM dian_tipos_documento)      AS tipos_documento,
       (SELECT COUNT(*) FROM dian_tipos_responsabilidad) AS tipos_responsabilidad,
       (SELECT COUNT(*) FROM dian_departamentos)         AS departamentos,
       (SELECT COUNT(*) FROM dian_municipios)            AS municipios;
