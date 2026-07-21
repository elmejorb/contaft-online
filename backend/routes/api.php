<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogoController;
use App\Http\Controllers\Tenant\ClienteController;
use App\Http\Controllers\Tenant\EmpresaConfigController;
use App\Http\Controllers\Tenant\FamiliaController;
use App\Http\Controllers\Tenant\ProductoController;
use App\Http\Controllers\Tenant\ProveedorController;
use App\Http\Controllers\Tenant\VentaCatalogoController;
use App\Http\Controllers\Tenant\VentaController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ============================================================
// PING — smoke test para verificar deploy
// ============================================================
Route::get('/ping', fn () => response()->json([
    'ok'      => true,
    'app'     => config('app.name'),
    'env'     => config('app.env'),
    'time'    => now()->toDateTimeString(),
    'version' => '0.1.0',
]));

// ============================================================
// CATÁLOGOS DIAN — públicos (los usa el signup + el form de clientes)
// ============================================================
Route::get('/catalogos',            [CatalogoController::class, 'index']);
Route::get('/catalogos/municipios', [CatalogoController::class, 'municipios']);
Route::get('/catalogos/unidades',   [CatalogoController::class, 'unidades']);

// ============================================================
// LANDLORD — signup + login públicos, resto requiere token
// ============================================================
Route::prefix('landlord')->group(function () {

    // Públicos
    Route::post('/signup', [AuthController::class, 'signup']);
    Route::post('/login',  [AuthController::class, 'login']);

    // Autenticados con Sanctum
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me',        [AuthController::class, 'me']);
        Route::delete('/logout', [AuthController::class, 'logout']);
    });
});

// ============================================================
// TENANT — todo lo del negocio de la empresa activa
// (clientes, productos, ventas, etc.)
// El middleware `resolve.tenant` carga la empresa activa en el request;
// los modelos con trait BelongsToEmpresa aplican `WHERE empresa_id = X`
// automáticamente vía scope global (row-level multi-tenant).
// ============================================================
Route::middleware(['auth:sanctum', 'resolve.tenant'])->group(function () {
    // Ping — devuelve la empresa activa (útil para debug del middleware)
    Route::get('/tenant/ping', function (Request $request) {
        $empresa = $request->attributes->get('empresa');
        return response()->json([
            'ok'          => true,
            'empresa_id'  => $empresa->id,
            'empresa'     => $empresa->razon_social,
            'nit'         => $empresa->nit,
            'trial_hasta' => $empresa->trial_hasta?->toDateString(),
        ]);
    });

    // === Config operativa de la empresa ===
    Route::get('/empresa-config',  [EmpresaConfigController::class, 'show']);
    Route::put('/empresa-config',  [EmpresaConfigController::class, 'update']);

    // === Datos maestros ===
    Route::apiResource('clientes',    ClienteController::class);
    Route::apiResource('productos',   ProductoController::class);
    Route::apiResource('familias',    FamiliaController::class)->except(['show']);
    Route::apiResource('proveedores', ProveedorController::class);

    // === Ventas / POS ===
    // Sin update: una venta emitida no se edita — se anula y se re-crea.
    Route::get('/ventas',            [VentaController::class, 'index']);
    Route::get('/ventas/{id}',       [VentaController::class, 'show'])->whereNumber('id');
    Route::post('/ventas',           [VentaController::class, 'store']);
    Route::post('/ventas/{id}/anular', [VentaController::class, 'anular'])->whereNumber('id');

    // Catálogos del POS
    Route::get('/vendedores',  [VentaCatalogoController::class, 'vendedores']);
    Route::get('/medios-pago', [VentaCatalogoController::class, 'mediosPago']);

    // Próximamente: /pagos (cartera), /kardex, /facturas-recibidas, ...
});
