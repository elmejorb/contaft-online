<?php

use App\Http\Controllers\AuthController;
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
    Route::get('/tenant/ping', function (Request $request) {
        $empresa = $request->attributes->get('empresa');
        return response()->json([
            'ok'         => true,
            'empresa_id' => $empresa->id,
            'empresa'    => $empresa->razon_social,
            'nit'        => $empresa->nit,
            'trial_hasta'=> $empresa->trial_hasta?->toDateString(),
        ]);
    });

    // Aquí irán: /clientes, /productos, /ventas, /facturas-recibidas, ...
});
