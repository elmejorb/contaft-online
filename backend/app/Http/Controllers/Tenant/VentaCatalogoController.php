<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\MedioPago;
use App\Models\Tenant\Vendedor;
use Illuminate\Http\JsonResponse;

/**
 * Catálogos auxiliares del POS: vendedores (por empresa) y medios de pago
 * (globales). Lecturas simples para poblar los selectores de la pantalla.
 */
class VentaCatalogoController extends Controller
{
    public function vendedores(): JsonResponse
    {
        return response()->json([
            'vendedores' => Vendedor::where('activo', 1)->orderBy('nombre')->get(),
        ]);
    }

    public function mediosPago(): JsonResponse
    {
        return response()->json([
            'medios_pago' => MedioPago::where('activo', 1)->orderBy('orden')->get(),
        ]);
    }
}
