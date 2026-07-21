<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\EmpresaConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Config operativa de la empresa activa.
 *   GET  /api/empresa-config       Devuelve la config (crea con defaults si no existe)
 *   PUT  /api/empresa-config       Actualiza campos parciales
 */
class EmpresaConfigController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $config = EmpresaConfig::firstOrCreate(
            ['empresa_id' => $request->attributes->get('empresa')->id],
            [
                'iva_incluido'         => true,
                'moneda'               => 'COP',
                'iniciar_factura_en'   => 1,
                'representante_cargo'  => 'Representante Legal',
                'representante_area'   => 'Administración',
            ]
        );
        return response()->json(['config' => $config]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'iva_incluido'                    => 'sometimes|boolean',
            'usa_fe'                          => 'sometimes|boolean',
            'usa_caja'                        => 'sometimes|boolean',
            'resolucion_fe'                   => 'sometimes|nullable|string|max:30',
            'resolucion_fecha'                => 'sometimes|nullable|date',
            'prefijo_fe'                      => 'sometimes|nullable|string|max:4',
            'rango_desde'                     => 'sometimes|nullable|integer|min:0',
            'rango_hasta'                     => 'sometimes|nullable|integer|min:0',
            'iniciar_factura_en'              => 'sometimes|integer|min:1',
            'moneda'                          => 'sometimes|string|size:3',
            'agente_retenedor'                => 'sometimes|boolean',
            'autorizar_devoluciones'          => 'sometimes|boolean',
            'autorizar_anulaciones'           => 'sometimes|boolean',
            'permitir_facturar_negativo'      => 'sometimes|boolean',
            'usar_familias'                   => 'sometimes|boolean',
            'usar_lotes'                      => 'sometimes|boolean',
            'imprimir_cotizacion'             => 'sometimes|boolean',
            'logo_path'                       => 'sometimes|nullable|string|max:500',
            'representante_tipo_doc_id'       => 'sometimes|nullable|integer',
            'representante_numero'            => 'sometimes|nullable|string|max:30',
            'representante_dv'                => 'sometimes|nullable|string|max:2',
            'representante_primer_nombre'     => 'sometimes|nullable|string|max:60',
            'representante_segundo_nombre'    => 'sometimes|nullable|string|max:60',
            'representante_primer_apellido'   => 'sometimes|nullable|string|max:60',
            'representante_segundo_apellido'  => 'sometimes|nullable|string|max:60',
            'representante_cargo'             => 'sometimes|string|max:80',
            'representante_area'              => 'sometimes|string|max:80',
        ]);

        $empresaId = $request->attributes->get('empresa')->id;
        $config = EmpresaConfig::firstOrCreate(['empresa_id' => $empresaId]);
        $config->update($data);

        return response()->json(['config' => $config->fresh()]);
    }
}
