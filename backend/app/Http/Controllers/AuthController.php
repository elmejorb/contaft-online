<?php

namespace App\Http\Controllers;

use App\Models\Landlord\Empresa;
use App\Models\Landlord\Plan;
use App\Models\Landlord\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Landlord Auth — endpoints públicos de signup + login + logout + me.
 *
 * Signup crea Usuario + Empresa + BD tenant en una transacción. Si falla
 * el provisioning de la BD, se hace rollback y no queda usuario huérfano.
 */
class AuthController extends Controller
{
    /**
     * POST /api/landlord/signup
     *
     * Body:
     *   razon_social, nit, email_contacto, telefono?
     *   email, password, nombre  (del usuario admin)
     *   plan_slug (default 'trial')
     *
     * Response 201: { token, usuario, empresa }
     */
    public function signup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'razon_social'     => 'required|string|max:200',
            'nit'              => 'required|string|max:20',
            'email_contacto'   => 'required|email|max:150',
            'telefono'         => 'nullable|string|max:50',
            'email'            => 'required|email|max:150|unique:landlord.usuarios,email',
            'password'         => 'required|string|min:8',
            'nombre'           => 'required|string|max:150',
            'plan_slug'        => 'nullable|string|max:60',
        ]);

        // NIT duplicado — 422 amable
        if (Empresa::where('nit', preg_replace('/\D/', '', $data['nit']))->exists()) {
            return response()->json([
                'message' => 'Ya hay una empresa registrada con ese NIT.',
                'errors'  => ['nit' => ['NIT duplicado']],
            ], 422);
        }

        $plan = Plan::where('slug', $data['plan_slug'] ?? 'trial')->where('activo', 1)->first()
             ?? Plan::where('slug', 'trial')->first();

        if (!$plan) {
            return response()->json(['error' => 'No hay planes configurados'], 500);
        }

        // Todo en una transacción — si algo falla, rollback completo.
        // Row-level tenant: no hay BD nueva que crear.
        DB::connection('landlord')->beginTransaction();

        try {
            // 1. Empresa
            $empresa = Empresa::create([
                'razon_social'   => $data['razon_social'],
                'nit'            => preg_replace('/\D/', '', $data['nit']),
                'email_contacto' => $data['email_contacto'],
                'telefono'       => $data['telefono'] ?? null,
                // bd_name se conserva por compatibilidad, apunta a la misma BD
                'bd_name'        => env('DB_DATABASE'),
                'plan_id'        => $plan->id,
                'trial_hasta'    => now()->addDays((int)($plan->features['trial_dias'] ?? 14)),
                'activa'         => 1,
            ]);

            // 2. Usuario admin
            $usuario = Usuario::create([
                'nombre'         => $data['nombre'],
                'email'          => $data['email'],
                'password_hash'  => Hash::make($data['password']),
                'activo'         => 1,
            ]);

            // 3. Vincular usuario-empresa
            $usuario->empresas()->attach($empresa->id, [
                'rol'             => 'admin',
                'empresa_default' => 1,
                'activo'          => 1,
            ]);

            // 4. Crear empresa_config con defaults sensatos
            DB::connection('landlord')->table('empresa_config')->insert([
                'empresa_id'          => $empresa->id,
                'iva_incluido'        => 1,
                'moneda'              => 'COP',
                'iniciar_factura_en'  => 1,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);

            // 5. Auditoría del signup
            DB::connection('landlord')->table('audit_log')->insert([
                'usuario_id' => $usuario->id,
                'empresa_id' => $empresa->id,
                'accion'     => 'signup',
                'detalles'   => json_encode([
                    'plan'   => $plan->slug,
                    'trial_hasta' => $empresa->trial_hasta->toDateString(),
                ]),
                'ip'         => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 500),
                'created_at' => now(),
            ]);

            DB::connection('landlord')->commit();
        } catch (\Throwable $e) {
            DB::connection('landlord')->rollBack();
            throw $e;
        }

        // Token Sanctum
        $token = $usuario->createToken('signup', ['*'])->plainTextToken;

        return response()->json([
            'token'   => $token,
            'usuario' => $usuario->only(['id', 'nombre', 'email']),
            'empresa' => $empresa->only([
                'id', 'razon_social', 'nit', 'trial_hasta',
                'suscripcion_hasta', 'activa',
            ]),
            'plan'    => $plan->only(['nombre', 'slug', 'features']),
        ], 201);
    }

    /**
     * POST /api/landlord/login
     * Body: { email, password }
     * Response 200: { token, usuario, empresas: [...] }
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $usuario = Usuario::where('email', $data['email'])->where('activo', 1)->first();
        if (!$usuario || !Hash::check($data['password'], $usuario->password_hash)) {
            return response()->json(['error' => 'Credenciales inválidas'], 401);
        }

        $usuario->update([
            'ultimo_login_at' => now(),
            'ultimo_ip'       => $request->ip(),
        ]);

        $empresas = $usuario->empresas()
            ->wherePivot('activo', 1)
            ->get()
            ->map(fn($e) => [
                'id'            => $e->id,
                'razon_social'  => $e->razon_social,
                'nit'           => $e->nit,
                'rol'           => $e->pivot->rol,
                'default'       => (bool) $e->pivot->empresa_default,
                'activa'        => $e->activa && $e->puedeOperar(),
            ]);

        $token = $usuario->createToken('login', ['*'])->plainTextToken;

        return response()->json([
            'token'    => $token,
            'usuario'  => $usuario->only(['id', 'nombre', 'email']),
            'empresas' => $empresas,
        ]);
    }

    /**
     * DELETE /api/landlord/logout — invalida el token actual.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada']);
    }

    /**
     * GET /api/landlord/me — datos del usuario + empresa activa.
     * Requiere token Sanctum.
     */
    public function me(Request $request): JsonResponse
    {
        $usuario = $request->user()->load('empresas.plan');
        return response()->json([
            'usuario'  => $usuario->only(['id', 'nombre', 'email', 'telefono']),
            'empresas' => $usuario->empresas->map(fn($e) => [
                'id'            => $e->id,
                'razon_social'  => $e->razon_social,
                'nit'           => $e->nit,
                'rol'           => $e->pivot->rol,
                'default'       => (bool) $e->pivot->empresa_default,
                'trial_hasta'   => $e->trial_hasta?->toDateString(),
                'suscripcion_hasta' => $e->suscripcion_hasta?->toDateString(),
                'activa'        => $e->activa && $e->puedeOperar(),
                'plan'          => $e->plan?->only(['nombre', 'slug', 'features']),
            ]),
        ]);
    }
}
