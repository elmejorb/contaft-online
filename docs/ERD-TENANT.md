# ERD — Tenant (BD por empresa)

Cada empresa cliente tiene su propia BD (`u408713046_cli_XX`) con el mismo
esquema. **Mejora estructural del schema desktop de Conta FT** — mismo dominio,
mejor normalización, PKs siempre AUTO_INCREMENT, campos DIAN persistidos desde
el INSERT, timestamps consistentes, snake_case.

Este documento agrupa las tablas por dominio funcional. El SQL completo está en
[../sql/02-tenant-template.sql](../sql/02-tenant-template.sql).

**Convenciones** (aplicadas a TODAS las tablas):
- PK siempre `id INT AUTO_INCREMENT PRIMARY KEY`.
- Timestamps `created_at`, `updated_at` (Laravel-style).
- FK con `_id` sufijo: `cliente_id`, `producto_id`, `usuario_id`.
- Booleanos como `TINYINT(1)` con default explícito.
- Monetario: `DECIMAL(15,2)`.
- Snake_case en columnas.
- Charset `utf8mb4`, engine `InnoDB`.
- Índices en TODOS los FKs y columnas de búsqueda.

---

## 1. Datos maestros

### `empresa_config`

Fila única con la configuración operativa. Reemplaza el `tbldatosempresa` del
desktop pero solo con los datos que NO se guardan en el landlord.

```
id PK · nit_ya_esta_en_landlord — este record es solo config operativa:
  - iva_incluido           BOOL (default 1)
  - resolucion_fe          VARCHAR(30)
  - resolucion_fecha       DATE
  - prefijo_fe             VARCHAR(4)
  - rango_desde, rango_hasta  INT
  - iniciar_factura_en     INT
  - moneda                 VARCHAR(3) default 'COP'
  - agente_retenedor       BOOL
  - autorizar_devoluciones BOOL
  - autorizar_anulaciones  BOOL
  - permitir_facturar_negativo BOOL
  - usar_familias          BOOL
  - usar_lotes             BOOL
  - imprimir_cotizacion    BOOL
  - logo_path              VARCHAR(500)
  - representante_tipo_doc VARCHAR(4)
  - representante_numero, representante_dv
  - representante_primer_nombre, ..._segundo_nombre
  - representante_primer_apellido, ..._segundo_apellido
  - representante_cargo, representante_area
  - email_factelect, password_factelect  (creds api-electronica)
  - api_electronica_url    VARCHAR(255) default 'https://api-electronica...'
```

### `municipios`, `departamentos`, `tipos_documento`, `tipos_organizacion`,
### `tipos_regimen`, `tipos_liability`, `unidades_medida`

Catálogos DIAN. Se pueden mantener sincronizados por un job desde api-electronica
o distribuir precargados. **Iguales para todos los tenants** — considerar
moverlos al landlord si el volumen lo justifica (~5000 municipios).

---

## 2. Personas

### `clientes`

```
id PK
codigo             VARCHAR(20) UNIQUE  (código interno, ej. "130552")
razon_social       VARCHAR(200)
tipo_persona       ENUM('natural','juridica')
tipo_documento_id  FK → tipos_documento
identificacion     VARCHAR(30)
dv                 VARCHAR(2) NULL
nombre_comercial   VARCHAR(200) NULL
email              VARCHAR(150)
telefono           VARCHAR(50)
whatsapp           VARCHAR(50) NULL
direccion          VARCHAR(200)
municipio_id       FK
regimen_id         FK
liability_id       FK (tipo responsabilidad)
cupo_credito       DECIMAL(15,2) DEFAULT 0
dias_credito       INT DEFAULT 0
fecha_cumpleanos   DATE NULL
observaciones      TEXT NULL
activo             BOOL DEFAULT 1
retenciones        JSON NULL   ← retenciones aplicables cuando se le vende
created_at, updated_at
INDEX(razon_social, identificacion, telefono)
```

### `proveedores`

Misma estructura que `clientes` con algunas diferencias:
```
+ tipo_proveedor      ENUM('bienes','servicios','ambos')
+ dias_pago           INT
+ retenciones_aplican JSON  ← cuando LES compramos
```

### `vendedores`

```
id PK
usuario_id          FK → landlord.usuarios (nullable si es solo etiqueta)
nombre              VARCHAR(150)
telefono            VARCHAR(50)
comision_pct        DECIMAL(5,2) DEFAULT 0
zona                VARCHAR(100) NULL
activo              BOOL DEFAULT 1
```

---

## 3. Inventario

### `familias`

```
id PK
codigo VARCHAR(20)
nombre VARCHAR(100)
padre_id FK → familias NULL   ← árbol de categorías
orden INT
activo BOOL
```

### `productos`

```
id PK
codigo               VARCHAR(30) UNIQUE
codigo_barras        VARCHAR(50) NULL
nombre               VARCHAR(200)
descripcion          TEXT NULL
familia_id           FK → familias NULL
unidad_medida_id     FK → unidades_medida
es_servicio          BOOL DEFAULT 0
tiene_componentes    BOOL DEFAULT 0
tiene_lotes          BOOL DEFAULT 0
precio_costo         DECIMAL(15,4)      ← YA incluye IVA (regla del desktop preservada)
precio_venta_1       DECIMAL(15,4)      ← YA incluye IVA
precio_venta_2       DECIMAL(15,4)
precio_venta_3       DECIMAL(15,4)
iva_pct              DECIMAL(5,2) DEFAULT 19
existencia           DECIMAL(15,3) DEFAULT 0
existencia_minima    DECIMAL(15,3) DEFAULT 0
ubicacion            VARCHAR(50) NULL
proveedor_id         FK → proveedores NULL
imagen_path          VARCHAR(500) NULL
notas                TEXT NULL
activo               BOOL DEFAULT 1
created_at, updated_at
INDEX(codigo, codigo_barras, nombre, familia_id)
```

### `producto_componentes`

Para productos compuestos (recetas):
```
id PK
padre_id      FK → productos
componente_id FK → productos
cantidad      DECIMAL(15,3)
```

### `producto_lotes`

```
id PK
producto_id      FK → productos
codigo_lote      VARCHAR(50)
fecha_vencimiento DATE NULL
existencia       DECIMAL(15,3)
precio_costo     DECIMAL(15,4)
created_at
INDEX(producto_id, fecha_vencimiento)
```

### `kardex`  (inmutable — NUNCA DELETE)

```
id                PK
fecha             DATETIME
producto_id       FK → productos
tipo              ENUM('entrada','salida','ajuste','reverso','anulacion')
concepto          VARCHAR(200)
referencia_tipo   VARCHAR(30)   ← 'venta', 'compra', 'ajuste_manual', etc.
referencia_id     INT NULL
cantidad_entrada  DECIMAL(15,3) DEFAULT 0
cantidad_salida   DECIMAL(15,3) DEFAULT 0
costo_unitario    DECIMAL(15,4)
costo_movimiento  DECIMAL(15,2)
saldo_cantidad    DECIMAL(15,3)
saldo_costo       DECIMAL(15,2)
usuario_id        FK → landlord.usuarios NULL
created_at
INDEX(producto_id, fecha)
```

---

## 4. Ventas + Facturación electrónica

### `ventas`

Cabecera de todas las ventas (POS, contado, crédito, cotización, FE, DS).

```
id                PK
numero            INT UNIQUE  ← consecutivo interno
tipo_documento    ENUM('pos','electronica','soporte','cotizacion')
tipo_termino      ENUM('contado','credito')  ← "Término" — no "Pago" (feedback UX del desktop)
dias_credito      INT DEFAULT 0
fecha             DATETIME
cliente_id        FK → clientes
vendedor_id       FK → vendedores NULL
lista_precio      TINYINT DEFAULT 1  (1, 2 o 3)
descuento_global  DECIMAL(15,2) DEFAULT 0
subtotal          DECIMAL(15,2)   ← base sin IVA
total_iva         DECIMAL(15,2)
total             DECIMAL(15,2)   ← total a pagar
comentario        TEXT NULL

# Cobros
medio_pago_id     FK → medios_pago NULL   (Efectivo/Tarjeta/Transferencia)
efectivo          DECIMAL(15,2) DEFAULT 0
transferencia     DECIMAL(15,2) DEFAULT 0
cambio            DECIMAL(15,2) DEFAULT 0
abono_inicial     DECIMAL(15,2) DEFAULT 0   ← para créditos con anticipo

# FE — se persisten desde el INSERT (bug histórico del desktop corregido)
payment_form_id    INT NULL      ← catálogo DIAN
payment_method_id  INT NULL      ← catálogo DIAN
payment_due_days   INT NULL
prefijo_fe         VARCHAR(4) NULL
numero_fe          BIGINT NULL   ← consecutivo DIAN
cufe               VARCHAR(96) UNIQUE NULL
cufe_url_qr        VARCHAR(500) NULL
dian_estado        ENUM('borrador','pendiente','enviado','autorizado','rechazado','anulado')
dian_response      LONGTEXT NULL
enviada_dian_at    DATETIME NULL
email_enviado      BOOL DEFAULT 0
email_enviado_at   DATETIME NULL

# Estado y trazabilidad
estado             ENUM('valida','anulada','borrador') DEFAULT 'valida'
anulada_at         DATETIME NULL
anulada_por        FK → landlord.usuarios NULL
anulada_motivo     VARCHAR(500) NULL
usuario_id         FK → landlord.usuarios
autorizado_por     FK → landlord.usuarios NULL  ← si venta requirió override
en_contingencia    BOOL DEFAULT 0
contingencia_motivo VARCHAR(255) NULL

created_at, updated_at
INDEX(numero, fecha, cliente_id, estado, dian_estado, cufe)
```

### `venta_lineas`

```
id                  PK
venta_id            FK → ventas
linea_num           INT
producto_id         FK → productos
descripcion_temp    VARCHAR(300) NULL   ← concepto editable para servicios
cantidad            DECIMAL(15,3)
precio_costo        DECIMAL(15,4)   ← histórico al momento de la venta
precio_venta        DECIMAL(15,4)
iva_pct             DECIMAL(5,2)
iva_monto           DECIMAL(15,2)
descuento_monto     DECIMAL(15,2) DEFAULT 0
subtotal            DECIMAL(15,2)   ← base sin IVA de la línea
total_linea         DECIMAL(15,2)
INDEX(venta_id, producto_id)
```

### `venta_retenciones`

```
id, venta_id FK, retencion_id FK → retenciones,
porcentaje, base, valor, aplicada_al ENUM('venta','pago')
```

### `notas_credito_debito`  (relaciones a `ventas` — DIAN 91/92)

Modela NC (evento contable) y ND. Se linkea a la venta original vía
`venta_original_id` + al CUFE original. Reusa la estructura de `ventas` con
`tipo_documento = 'nota_credito' / 'nota_debito'`.

### `facturas_recibidas`, `detalle_factura_recibida`, `eventos_factura_recibida`

**Idénticas** al módulo del desktop 4.3.63 pero con la corrección del UNIQUE
KEY desde el diseño (`aprobado_marker` columna generada). Ver
[el módulo del desktop](../../AppReactConta/conta-app-backend/sql/actualizacion_completa.sql)
para el SQL exacto — se copia y se adapta a snake_case.

---

## 5. Cartera + Pagos

### `pagos`

Recibos de caja aplicados a facturas de venta.

```
id                PK
consecutivo       INT UNIQUE
fecha             DATETIME
cliente_id        FK
venta_id          FK → ventas
medio_pago_id     FK → medios_pago
valor             DECIMAL(15,2)
descuento         DECIMAL(15,2) DEFAULT 0   ← rebaja aplicada al pago
retencion         DECIMAL(15,2) DEFAULT 0
detalle           VARCHAR(300)
usuario_id        FK
estado            ENUM('valida','anulada') DEFAULT 'valida'
anulado_at, anulado_por, anulado_motivo
created_at
INDEX(cliente_id, venta_id, fecha)
```

### VISTA `vw_facturas_saldo`

Reemplaza `vw_facturas_cliente_saldos` del desktop. **Ya incorpora los fixes**
(descuento sumado + validación por estado y anulación):

```sql
CREATE VIEW vw_facturas_saldo AS
SELECT v.id AS venta_id, v.numero, v.cliente_id, v.fecha, v.dias_credito,
       DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY) AS fecha_vencimiento,
       v.total,
       COALESCE(p.total_pagado, 0) AS total_pagado,
       GREATEST(v.total - COALESCE(p.total_pagado, 0), 0) AS saldo,
       DATEDIFF(CURDATE(), DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY)) AS dias_vencido
FROM ventas v
LEFT JOIN (
    SELECT venta_id, SUM(valor + COALESCE(descuento, 0)) AS total_pagado
    FROM pagos
    WHERE estado = 'valida'
    GROUP BY venta_id
) p ON p.venta_id = v.id
WHERE v.tipo_termino = 'credito'
  AND v.estado = 'valida';
```

---

## 6. Compras + Gastos

Estructura análoga a ventas + kardex de entrada. Detallado en el SQL.

- `compras` (cabecera)
- `compra_lineas`
- `pagos_proveedor`
- `gastos` (con `categoria_gasto_id`)
- `categorias_gasto`

---

## 7. Cajas

```
cajas               id, nombre, codigo, activa
sesiones_caja       id, caja_id, usuario_id, apertura_at, cierre_at,
                    monto_inicial, monto_final, diferencia, estado
movimientos_caja    id, sesion_id, tipo(ingreso/egreso/venta),
                    referencia, valor, medio_pago_id, comentario
```

---

## 8. Auxiliares

- `medios_pago` (Efectivo, Tarjeta, Bancolombia, Nequi, etc.)
- `retenciones` (Fuente, IVA, ICA con códigos DIAN)
- `notas_articulo` (avisos internos por producto)
- `notificaciones` (sistema de alertas: stock bajo, vencimientos, cumpleaños)
- `configuraciones_impresion` (formato tirilla/carta, config por caja)

---

## Total tablas tenant: ~35

Sin contar catálogos DIAN si se llevan al landlord. Con catálogos, ~45.

**Comparación con desktop**: el desktop tiene ~60 tablas pero muchas son
duplicadas (`tblfacturasanteriores` legacy VB6, `tblpedidos` sin usar,
`tblmovimientos` deprecada). El SaaS arranca limpio con solo lo necesario.
