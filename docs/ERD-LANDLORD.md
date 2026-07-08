# ERD — Landlord (BD compartida)

Base de datos: `u408713046_dbcontaft` en Hostinger MariaDB 11.8.

Contiene lo transversal al SaaS: empresas registradas, usuarios, planes,
suscripciones, historial de eventos globales. NO guarda facturas, clientes ni
productos — esos viven en cada BD tenant.

```
┌─────────────────────────┐
│         planes          │
│─────────────────────────│
│ id           PK         │
│ nombre                  │
│ precio_mensual  DECIMAL │
│ max_empresas    INT     │  (por si un usuario contador maneja varias)
│ max_ventas_mes  INT     │
│ max_usuarios    INT     │
│ features        JSON    │  (flags: fe_dian, kardex, informes_pro, ...)
│ activo          BOOL    │
│ orden           INT     │
│ created_at              │
└─────────────────────────┘
             ▲
             │ 1
             │ N
┌─────────────────────────────────────────────────────────────┐
│                       empresas                              │
│─────────────────────────────────────────────────────────────│
│ id            PK                                             │
│ razon_social       VARCHAR(200)   NOT NULL                   │
│ nit                VARCHAR(20)    UNIQUE (sin DV)            │
│ dv                 VARCHAR(2)                                │
│ email_contacto     VARCHAR(150)                              │
│ telefono           VARCHAR(50)                               │
│ direccion          VARCHAR(200)                              │
│ id_municipio       INT                                       │
│ id_regimen         INT   (Común/Simplificado/Simple)         │
│ id_organizacion    INT   (Jurídica/Natural)                  │
│ id_tipo_doc        INT   (NIT/CC/CE)                         │
│ bd_name            VARCHAR(64)  UNIQUE  ← "u408713046_cli_X" │
│ plan_id            FK → planes                               │
│ trial_hasta        DATE                                      │
│ suscripcion_hasta  DATE                                      │
│ activa             BOOL   DEFAULT 1                          │
│ suspendida_motivo  VARCHAR(255) NULL                         │
│ logo_url           VARCHAR(500) NULL   ← path relativo       │
│ created_at, updated_at                                       │
└─────────────────────────────────────────────────────────────┘
             ▲ N
             │
             │ N   (un contador puede administrar N empresas — tabla puente)
             │
┌─────────────────────────────────────────┐    ┌───────────────────────────────┐
│         usuarios_empresas               │    │           usuarios             │
│─────────────────────────────────────────│    │───────────────────────────────│
│ id         PK                           │    │ id           PK               │
│ usuario_id      FK → usuarios           │    │ email        UNIQUE           │
│ empresa_id      FK → empresas           │    │ password_hash                 │
│ rol             ENUM('admin','contador',│    │ nombre                        │
│                  'vendedor','bodega')   │    │ telefono                      │
│ empresa_default BOOL                    │    │ email_verificado_at           │
│ activo          BOOL                    │    │ ultimo_login_at               │
│ created_at                              │    │ activo         BOOL           │
└─────────────────────────────────────────┘    │ created_at                    │
                                                └───────────────────────────────┘
                                                        ▲ 1
                                                        │ N
                                                ┌───────────────────────────────┐
                                                │  personal_access_tokens       │  (Sanctum)
                                                │───────────────────────────────│
                                                │ id, tokenable_id, name,       │
                                                │ token (hash), abilities,      │
                                                │ last_used_at, expires_at      │
                                                └───────────────────────────────┘

┌─────────────────────────────────────────┐
│         subscripciones                  │
│─────────────────────────────────────────│
│ id             PK                       │
│ empresa_id     FK → empresas            │
│ plan_id        FK → planes              │
│ inicio         DATE                     │
│ fin            DATE                     │
│ monto          DECIMAL(15,2)            │
│ estado         ENUM('activa','vencida', │
│                'cancelada','morosa')    │
│ metodo_pago    VARCHAR(50) NULL         │
│ pasarela_ref   VARCHAR(200) NULL        │ (Wompi transaction id, etc.)
│ notas          TEXT NULL                │
│ created_at                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         facturas_saas                   │  (Lo que Innovacion Digital le cobra
│─────────────────────────────────────────│   al cliente por usar la plataforma)
│ id             PK                       │
│ empresa_id     FK → empresas            │
│ subscripcion_id FK → subscripciones     │
│ numero         VARCHAR(20) UNIQUE       │
│ fecha          DATE                     │
│ monto          DECIMAL(15,2)            │
│ estado         ENUM('pendiente','paga', │
│                'anulada')               │
│ pdf_path       VARCHAR(500)             │
│ created_at                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         audit_log                       │  (Trazabilidad de acciones críticas)
│─────────────────────────────────────────│
│ id             PK                       │
│ usuario_id     FK → usuarios (nullable) │
│ empresa_id     FK → empresas (nullable) │
│ accion         VARCHAR(80)              │  signup / login / plan_change / suspend
│ detalles       JSON                     │
│ ip             VARCHAR(45)              │
│ user_agent     VARCHAR(500)             │
│ created_at                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         migraciones_tenant              │  (Control de qué versión de esquema
│─────────────────────────────────────────│   tiene cada BD tenant — evita
│ id             PK                       │   inconsistencias)
│ empresa_id     FK → empresas            │
│ version        VARCHAR(20)              │  ej. '4.4.0'
│ ejecutada_at   DATETIME                 │
│ resultado      ENUM('ok','error')       │
│ error_msg      TEXT NULL                │
└─────────────────────────────────────────┘
```

## Notas de diseño

**Sobre `bd_name`**: se genera automáticamente al signup como
`u408713046_cli_{slug(razon_social)}` recortado a 40 chars y garantizando único.
Ejemplo:
- Razón social: `AMMI ACCESORIOS SAS`
- Slug: `ammi_accesorios`
- bd_name: `u408713046_cli_ammi_accesorios`

**Sobre trial/suscripción**: cuando `trial_hasta < NOW()` y no hay suscripción
activa → `empresas.activa = 0` automáticamente por un cron diario. La
autenticación revisa `activa` y devuelve 403 si está suspendida.

**Sobre usuarios_empresas**: un contador puede administrar varias empresas
(caso muy común en Colombia). Al login, si tiene más de una empresa asociada,
el frontend muestra un selector.

**Sobre audit_log**: sirve para investigar incidentes ("¿quién bajó a esta
empresa?", "¿desde dónde entró el usuario?"). No detalla operaciones internas
de negocio (esas viven en el kardex del tenant).
