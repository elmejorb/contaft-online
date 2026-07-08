<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Tenant\ClienteController;
use App\Http\Controllers\Tenant\EmpresaConfigController;
use App\Http\Controllers\Tenant\FamiliaController;
use App\Http\Controllers\Tenant\ProductoController;
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
    Route::apiResource('clientes',  ClienteController::class);
    Route::apiResource('productos', ProductoController::class);
    Route::apiResource('familias',  FamiliaController::class)->except(['show']);

    // Próximamente: /ventas, /pagos, /kardex, /facturas-recibidas, ...
});
