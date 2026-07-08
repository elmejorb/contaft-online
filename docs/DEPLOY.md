# Deploy — Conta FT Online

Instrucciones para desplegar a Hostinger productivo. **Sin CI/CD por ahora** —
todo es manual con FTP. Se automatizará cuando el proyecto crezca.

---

## Requisitos locales

- PHP 8.2+ (ya lo tienes por Conta FT desktop)
- Composer 2.x
- Node.js 20+ y npm
- Cliente FTP (FileZilla o el `robocopy`/curl que ya usamos)

---

## Primera vez — bootstrap

### 1. Aplicar landlord SQL a Hostinger

Ya está hecho. Si necesitas re-crear:

```bash
mysql -h 193.203.166.104 -u u408713046_uscontaft -p'X7R!TAQ0>5a!' u408713046_dbcontaft \
  < sql/01-landlord.sql
```

Verificar: 9 tablas + 4 planes.

### 2. Deploy del backend (Laravel)

```bash
cd backend
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
```

**Estructura a subir** (a `/facturacion/api/` en Hostinger):

```
api/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/          ← docroot
├── resources/
├── routes/
├── storage/
├── vendor/          (subir sí — no hay composer en el host)
├── .htaccess        (con RewriteBase /facturacion/api/public)
├── .env             (crear manualmente en el host — no en el repo)
└── artisan
```

Configurar `/facturacion/api/.htaccess` para que apunte al `public/`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

Y crear `/facturacion/api/.env` en Hostinger con:

```
APP_NAME="Conta FT Online"
APP_ENV=production
APP_KEY=base64:...    ← generar con `php artisan key:generate --show`
APP_DEBUG=false
APP_URL=https://facturacion.innovacion-digital.com/api

DB_CONNECTION=mysql
DB_HOST=193.203.166.104
DB_PORT=3306
DB_DATABASE=u408713046_dbcontaft
DB_USERNAME=u408713046_uscontaft
DB_PASSWORD=X7R!TAQ0>5a!

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

SANCTUM_STATEFUL_DOMAINS=facturacion.innovacion-digital.com

# API DIAN externa (compartida con desktop)
API_ELECTRONICA_URL=https://api-electronica.innovacion-digital.com/public
```

### 3. Deploy del frontend (React SPA)

```bash
cd frontend
npm ci
VITE_API_URL=https://facturacion.innovacion-digital.com/api npm run build
```

Subir contenido de `frontend/dist/` a `/facturacion/` en Hostinger (reemplaza
`default.php`).

En `frontend/dist/.htaccess`:

```apache
# Router SPA — todas las rutas caen a index.html excepto assets reales
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

---

## Deploys sucesivos

Para el backend, subir solo lo que cambió (Laravel es "hot deployable"):

- Cambios en `app/`, `routes/`, `config/` → subir esos archivos.
- Después ejecutar `php artisan config:clear` si tuvieras acceso a artisan
  en el host (no lo tenemos en Hostinger compartido; alternativa: subir un
  `bootstrap/cache/config.php` regenerado local).

Para el frontend, cada `npm run build` genera un `dist/` limpio — subir todo
o solo los cambios de `assets/index-{hash}.js`.

---

## Migraciones tenant (crear nueva empresa)

Cuando se hace signup de una empresa:

1. Backend Laravel corre:
   ```php
   $bd = 'u408713046_cli_' . $slug;
   DB::statement("CREATE DATABASE {$bd} CHARACTER SET utf8mb4");
   ```
2. Aplica el template `sql/02-tenant-template.sql` a esa BD.
3. Guarda `bd_name` en `empresas.bd_name`.
4. Registra en `migraciones_tenant` el `version` aplicado.

**Aviso**: Hostinger Business tiene límite de bases de datos por cuenta.
Verificar el plan actual y monitorear cuando se acerca al límite.

---

## Backups

**Automáticos** (Hostinger hace 1 semanal — verificar plan).

**Manuales por cliente** (recomendado antes de cambios grandes):
```bash
mysqldump -h 193.203.166.104 -u u408713046_uscontaft -p'X7R!TAQ0>5a!' \
  u408713046_cli_ammi > backup_ammi_$(date +%Y%m%d).sql
```

**Landlord** (crítico — sin esto no hay auth):
```bash
mysqldump -h 193.203.166.104 -u u408713046_uscontaft -p'X7R!TAQ0>5a!' \
  u408713046_dbcontaft > backup_landlord_$(date +%Y%m%d).sql
```

---

## Rollback rápido

Si un deploy sale mal:

- **Frontend**: subir el `dist/` de la versión anterior (mantener carpetas
  `dist-vX.Y/` con builds firmados como respaldo).
- **Backend**: git checkout de la versión anterior + rebuild `vendor/` + re-subir.
- **BD**: `mysql < backup_landlord_YYYYMMDD.sql` (para el landlord). Para
  tenants, importar el dump correspondiente.

---

## Checklist antes de cada release

- [ ] `.env` productivo verificado (no está en el repo).
- [ ] `composer install --no-dev` — sin dependencias de dev.
- [ ] `npm run build` sin errores TypeScript.
- [ ] Tests pasan (cuando los tengamos).
- [ ] Backup del landlord ANTES de subir.
- [ ] Deploy en horario de bajo tráfico (típicamente noche).
- [ ] Smoke test post-deploy: signup + login + crear cliente + emitir venta.
