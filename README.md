# Conta FT Online

Plataforma SaaS multi-empresa de facturación electrónica DIAN Colombia. Versión web
del sistema Conta FT desktop existente.

> ⚠️ **En desarrollo** — arrancó 2026-07-08. Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
> para el estado real de cada módulo.

## Visión

Sistema contable / POS / facturación electrónica para pequeñas y medianas empresas
colombianas. Cada empresa cliente contrata un plan y tiene su propia base de datos
aislada. Los módulos replican y mejoran los del Conta FT desktop actual:

- Datos maestros (empresa, clientes, productos, proveedores)
- Ventas (Contado, Crédito, Cotización, POS)
- Facturación electrónica DIAN (emisión + recibidas)
- Cartera, kardex, cajas
- Compras, gastos, retenciones
- Informes contables

## Arquitectura de alto nivel

```
┌──────────────────────────────────┐
│  SPA React                       │  facturacion.innovacion-digital.com/
│  (Vite + TS + AG Grid + Radix)   │
└─────────────┬────────────────────┘
              │ HTTPS + JWT (Sanctum)
              ▼
┌──────────────────────────────────┐
│  API REST Laravel 11             │  facturacion.innovacion-digital.com/api/
│  ├─ /landlord/*  (auth, planes)  │
│  └─ /tenant/*    (datos empresa) │
└──────┬──────────────────┬────────┘
       │                  │
       │                  │ SET SESSION USE db_of_tenant
       ▼                  ▼
┌────────────────┐   ┌───────────────────────────┐
│  BD Landlord   │   │  BDs de cada empresa      │
│  empresas      │   │  ├─ u408713046_cli_ammi   │
│  usuarios      │   │  ├─ u408713046_cli_fjd    │
│  planes        │   │  └─ u408713046_cli_XX     │
│  suscripciones │   │  (mismo esquema, aislados)│
└────────────────┘   └───────────────────────────┘

Servicio DIAN externo (compartido con desktop):
  api-electronica.innovacion-digital.com
```

## Stack

- **Backend**: Laravel 11 · PHP 8.2 · Sanctum (auth por token) · Eloquent + PDO nativo
  para consultas cross-tenant.
- **Frontend**: React 18 · TypeScript · Vite · Tailwind CSS · AG Grid · Radix UI ·
  react-hot-toast · lucide-react. Ya se usan en el desktop — se portan componentes.
- **BD**: MariaDB 11.8 (Hostinger).
- **Auth**: Laravel Sanctum con tokens Bearer (SPA cross-domain).
- **DIAN**: reutiliza `api-electronica.innovacion-digital.com` (Lumen productiva)
  como microservicio — mismo endpoint que ya usa el desktop.

## Estructura del repositorio

```
ContaFtOnline/
├── backend/          Laravel 11 API
├── frontend/         React + Vite SPA
├── docs/             Documentación técnica
│   ├── ARQUITECTURA.md
│   ├── ERD-LANDLORD.md
│   ├── ERD-TENANT.md
│   └── DEPLOY.md
├── sql/              Migraciones "puras" para arrancar sin Laravel
│   ├── 01-landlord.sql
│   └── 02-tenant-template.sql
├── scripts/          Utilitarios (crear BD tenant, backfill desde desktop, etc.)
└── README.md         (este archivo)
```

## Desarrollo local

**Backend**:
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan serve   # http://localhost:8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Ambos apuntan a la BD Hostinger productiva por default. Para trabajar contra
MySQL local, cambiar credenciales en `.env` del backend.

## Deploy

Ver [docs/DEPLOY.md](docs/DEPLOY.md). Resumen:

```bash
# Backend (correr LOCAL)
cd backend && composer install --optimize-autoloader --no-dev
# Luego subir por FTP a /facturacion/api/  (excepto .env)

# Frontend
cd frontend && npm run build
# Subir dist/ a /facturacion/  (reemplaza default.php)
```

## Estado del proyecto

Ver [docs/ARQUITECTURA.md § Roadmap](docs/ARQUITECTURA.md#roadmap) para el estado
por fase. La versión actual está en fase de **Fundaciones** (docs + SQL base + repo).
