<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware que resuelve la empresa activa para cada request autenticada.
 * Debe ir DESPUÉS de auth:sanctum en el pipeline.
 *
 * Arquitectura row-level multi-tenant: la BD es una sola
 * (u408713046_dbcontaft). Este middleware NO cambia conexiones DB — solo
 * carga la empresa activa en el request. El aislamiento entre empresas lo
 * garantiza el trait BelongsToEmpresa + EmpresaScope global, que agregan
 * automáticamente `WHERE empresa_id = X` a toda query de modelos tenant.
 *
 * Empresa activa se resuelve así:
 *   1. Header X-Empresa-Id si el usuario tiene varias empresas asociadas.
 *   2. Empresa marcada como default en usuarios_empresas.
 *
 * Si no hay tenant válido (no auth, empresa suspendida) devuelve 403.
 */
class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        // Empresa activa: por header X-Empresa-Id (si el usuario tiene varias)
        // o la marcada como default.
        $empresaHeader = $request->header('X-Empresa-Id');
        if ($empresaHeader) {
            $empresa = $user->empresas()
                ->wherePivot('activo', 1)
                ->where('empresas.id', (int) $empresaHeader)
                ->first();
        } else {
            $empresa = $user->empresaDefault();
        }

        if (!$empresa) {
            return response()->json([
                'error' => 'Sin empresa asociada. Contacta a soporte.',
            ], 403);
        }

        if (!$empresa->puedeOperar()) {
            return response()->json([
                'error'   => 'Empresa suspendida o suscripción vencida.',
                'motivo'  => $empresa->suspendida_motivo,
                'empresa' => $empresa->only(['id', 'razon_social', 'activa', 'trial_hasta', 'suscripcion_hasta']),
            ], 403);
        }

        // Adjuntar la empresa al request — EmpresaScope global la lee de aquí
        $request->attributes->set('empresa', $empresa);

        return $next($request);
    }
}
