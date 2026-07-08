# Arquitectura — Conta FT Online

Documento vivo. Refleja las decisiones tomadas y el estado de cada módulo. Cuando
cambies algo estructural, actualízalo acá primero.

**Versión del doc**: 0.1 · **Última actualización**: 2026-07-08

---

## 1. Decisiones fundacionales

| # | Decisión | Justificación breve |
|---|---|---|
| D1 | **Multi-tenant = row-level** (columna `empresa_id` en cada tabla, todas en `u408713046_dbcontaft`) | Hostinger compartido NO permite `CREATE DATABASE` al usuario MySQL — descartado schema-per-tenant. Row-level da: 1 BD para backup, migraciones simples, reportes cross-empresa fáciles. Aislamiento garantizado por **EmpresaScope global** en Eloquent (imposible olvidar el filtro). |
| D2 | **Backend Laravel 11 + Sanctum** | Ya conoces Lumen (api-electronica). PHP 8.2.30 disponible en Hostinger. Sanctum resuelve auth SPA sin JWT propio. |
| D3 | **Frontend SPA React + Vite** (separada) | Build → subir `dist/`. Consume la API por REST. Reutilizamos componentes del desktop (`NuevaVenta.tsx`, `InventarioManagement.tsx`, etc.). |
| D4 | **BD: MariaDB 11.8 en Hostinger** | Descartado PostgreSQL — hosting compartido solo MySQL/MariaDB. |
| D5 | **DIAN vía api-electronica productiva** | Microservicio ya operativo. La plataforma NO firma XML localmente. |
| D6 | **Hosting compartido Hostinger** para MVP | Costo cero al ya tenerlo. Migrar a VPS cuando > 50 empresas o cuando la carga lo pida. |

---

## 2. Diagrama de despliegue

```
┌───────────────────────────────────────────────────────────────┐
│   Navegador cliente                                            │
│   facturacion.innovacion-digital.com  (React SPA)             │
│   ← Bearer token (Sanctum) → /api/*                            │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS Cloudflare
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  Hostinger — nginx + PHP 8.2                                   │
│  ┌──────────────────────────────┐  ┌──────────────────────┐   │
│  │  /facturacion/               │  │  /facturacion/api/   │   │
│  │  (dist/ del build React)     │  │  Laravel 11          │   │
│  └──────────────────────────────┘  └──────────┬───────────┘   │
└───────────────────────────────────────────────┼───────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
     ┌──────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
     │ MariaDB — Landlord       │  │ MariaDB — Tenants    │  │ api-electronica          │
     │ u408713046_dbcontaft     │  │ u408713046_cli_ammi  │  │ (Lumen externo)          │
     │ ├─ empresas              │  │ u408713046_cli_fjd   │  │ Firma XML DIAN,          │
     │ ├─ usuarios              │  │ u408713046_cli_XX    │  │ envío SOAP, eventos      │
     │ ├─ planes                │  │ ...                  │  └──────────────────────────┘
     │ └─ suscripciones         │  │ (mismo esquema)      │
     └──────────────────────────┘  └──────────────────────┘
```

---

## 3. Estrategia multi-tenant (row-level)

### Signup

1. Usuario visita `facturacion.innovacion-digital.com/signup`.
2. Rellena: razón social, NIT, email, password, plan.
3. POST `/api/landlord/signup` →
   - INSERT en `empresas` (una fila más en la única BD).
   - INSERT en `usuarios` + vinculación en `usuarios_empresas` con `rol='admin'`.
   - INSERT en `empresa_config` con defaults (`iva_incluido=1`, `moneda='COP'`).
   - Registro en `audit_log`.
   - Trial de 14 días activo.
4. Login con token Sanctum → toda request lleva `Authorization: Bearer …`.

### Middleware `ResolveTenant`

Cada request autenticada resuelve la **empresa activa** (sin cambiar conexiones DB):

```php
public function handle(Request $request, Closure $next): Response
{
    $user = $request->user();  // Sanctum
    if (!$user) return response()->json(['error' => 'No autenticado'], 401);

    // Empresa activa por header X-Empresa-Id o la default del usuario
    $empresa = $request->header('X-Empresa-Id')
        ? $user->empresas()->wherePivot('activo',1)->find((int) $request->header('X-Empresa-Id'))
        : $user->empresaDefault();

    if (!$empresa || !$empresa->puedeOperar()) {
        return response()->json(['error' => 'Empresa suspendida o sin suscripción'], 403);
    }

    // Adjuntar al request. EmpresaScope la lee de aquí.
    $request->attributes->set('empresa', $empresa);
    return $next($request);
}
```

### Aislamiento por Global Scope

Todos los modelos tenant (Cliente, Producto, Venta, Pago, etc.) usan el trait
**`BelongsToEmpresa`**, que agrega automáticamente:

```php
static::addGlobalScope(new EmpresaScope);

static::creating(function ($model) {
    if (empty($model->empresa_id)) {
        $model->empresa_id = BelongsToEmpresa::empresaIdActual();
    }
});
```

`EmpresaScope` inyecta un `WHERE empresa_id = X` a **toda query** — imposible
olvidarlo:

```php
Cliente::all();
// → SELECT * FROM clientes WHERE empresa_id = 42   (auto)
Cliente::create(['razon_social' => 'ACME', 'identificacion' => '900...']);
// → INSERT ... (empresa_id, razon_social, ...) VALUES (42, 'ACME', ...)   (auto)
```

Los modelos del landlord (Empresa, Usuario, Plan) NO usan el trait — son
globales entre empresas.

### Aislamiento garantizado

- **Cross-tenant queries imposibles** en modelos con `BelongsToEmpresa`: el
  scope global filtra siempre. Un desarrollador olvidadizo NO puede leer datos
  de otra empresa por accidente.
- **Backups**: 1 solo `mysqldump u408713046_dbcontaft` respalda TODO el SaaS.
- **Baja de cliente**: `DELETE FROM empresas WHERE id = X` — la FK `ON DELETE
  CASCADE` limpia clientes/productos/ventas/etc. automáticamente.
- **Reportes cross-empresa (super-admin)**: fáciles con
  `->withoutGlobalScope(EmpresaScope::class)`.

---

## 4. Auth con Sanctum

Sanctum modo **API token** (no cookies) para simplificar CORS:

- POST `/api/landlord/login` con `{email, password}` → 200 con `{token, empresa}`.
- Frontend guarda el token en `localStorage` (o mejor, `sessionStorage`).
- Cada request `Authorization: Bearer <token>`.
- Logout → DELETE `/api/landlord/logout` invalida el token.

### Roles y permisos (dentro de una empresa)

- `admin` — dueño / representante legal. Acceso total.
- `contador` — módulos de informes + edición limitada.
- `vendedor` — solo POS + consultas de sus propias ventas.
- `bodega` — inventario, kardex, entradas/salidas.

Se implementa con Laravel Policies + un campo `rol` en `landlord.usuarios`.

---

## 5. Módulos y roadmap

### MVP (Fases 0-3)

| Módulo | Estado | Notas |
|---|---|---|
| Fundaciones (repo, BD, docs) | 🔄 en curso | Estos docs |
| Auth + multi-tenant + signup | ⏳ | Fase 1 |
| Datos maestros (empresa, clientes, productos, catálogos DIAN) | ⏳ | Fase 2 |
| Ventas: POS, contado, crédito, cotización | ⏳ | Fase 3 |
| FE emisión (vía api-electronica) | ⏳ | Fase 3 |
| Impresión (tirilla + PDF) | ⏳ | Fase 3 |

### V1.1 — Comercial completo (Fases 4-5)

| Módulo | Estado | Notas |
|---|---|---|
| Cartera clientes + pagos con descuento | ⏳ | Ya con fix incorporado desde el inicio |
| Compras + Facturas Recibidas + eventos DIAN | ⏳ | Portar módulo desktop 4.3.63 |
| Kardex inmutable | ⏳ | Con vistas SQL de saldos |
| Cajas: apertura, cierre, cuadre | ⏳ | Sesiones + movimientos |

### V1.2 — Paridad con desktop (Fase 6)

| Módulo | Estado | Notas |
|---|---|---|
| Gastos + categorías | ⏳ | |
| Retenciones (fuente, IVA, ICA) con gross-up | ⏳ | |
| Notas crédito/débito DIAN | ⏳ | |
| Documento Soporte (DS) | ⏳ | |
| Informes (ventas, compras, IVA, kardex) | ⏳ | |
| Notificaciones (stock bajo, vencimientos, cumpleaños) | ⏳ | |

### V1.3 — SaaS full (Fase 7)

| Módulo | Estado | Notas |
|---|---|---|
| Portal super-admin (todas las empresas) | ⏳ | |
| Planes + trial + pasarela pago (Wompi) | ⏳ | |
| Facturación al cliente (autofactura del SaaS) | ⏳ | |
| Cron: suspender cuentas vencidas | ⏳ | |
| Migración one-click desde desktop | ⏳ | Script que empaqueta BD local + upload |

---

## 6. Lecciones aprendidas del desktop (para NO repetir)

Todas están registradas como memoria de Claude. Resumen:

- **IVA incluido en el precio**: cuando `IvaIncluido=1`, NO aplicar `× (1 + iva/100)`
  en cálculos de COGS/totales. Extraer con `× iva/(100+iva)`. (Bug clásico
  arreglado en 4.3.55/4.3.61).
- **Descuentos en pagos**: `tblpagos.Descuento` va sumado a `ValorPago` al
  calcular saldo. (Bug arreglado en Ammi 4.3.63).
- **Kardex inmutable**: nunca `DELETE FROM tblkardex`. Correcciones vía asientos
  opuestos (REVERSO / ANULACIÓN).
- **AUTO_INCREMENT en PKs**: siempre. Desktop tuvo bugs con `tblcotizaciones`,
  `detalle_document_electronic`, etc. donde faltaba.
- **payment_form_id / due_days**: los campos DIAN deben persistirse desde el
  primer INSERT — no depender del cache de `tblventas`.
- **Facturas anuladas**: se excluyen de TODO cálculo (cartera, historial, saldos).
  El cache `Saldo` NO manda.
- **Régimen simplificado / no responsable**: `IVA = 0` a pesar de que el catálogo
  lo tenga en 5% o 19%.

Estas reglas se codifican como constraints, validators y tests desde el día 1
en el proyecto nuevo, no como parches sucesivos.

---

## 7. Endpoints principales (spec)

### Landlord

```
POST   /api/landlord/signup          Crear empresa + usuario + BD tenant
POST   /api/landlord/login           Autenticar → devuelve Bearer token
DELETE /api/landlord/logout          Invalidar token actual
GET    /api/landlord/me              Datos del usuario + empresa autenticada
GET    /api/landlord/planes          Listar planes disponibles
POST   /api/landlord/subscripcion    Upgrade / renovación
```

### Tenant (todas requieren token + resuelven BD según empresa)

```
GET/POST/PUT/DELETE  /api/clientes
GET/POST/PUT/DELETE  /api/productos
GET/POST             /api/ventas
GET                  /api/ventas/:id
POST                 /api/ventas/:id/anular
POST                 /api/facturacion-electronica/enviar     (proxy a api-electronica)
POST                 /api/facturas-recibidas/subir           (con ZIP/XML)
POST                 /api/facturas-recibidas/eventos         (proxy a api-electronica)
GET                  /api/cartera
POST                 /api/cartera/pago
GET                  /api/informes/ventas
GET                  /api/informes/iva
...  (~100 endpoints al final del MVP)
```

---

## 8. Diagrama ERD

Ver [ERD-LANDLORD.md](ERD-LANDLORD.md) y [ERD-TENANT.md](ERD-TENANT.md).

---

## 9. Referencias

- Código fuente API DIAN: `C:\...\facturación-dian-manager-innv\api-electronica\`
- Sistema desktop original: `C:\...\AppReactConta\`
- Doc DIAN eventos acuse: `AppReactConta/Guia-eventos-acuse-otro-sistema.md`
