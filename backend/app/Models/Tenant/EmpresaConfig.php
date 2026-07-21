<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;

/**
 * Configuración operativa de cada empresa (1 fila por empresa).
 * Incluye preferencias fiscales (IVA incluido, resolución FE, prefijo)
 * y datos del representante legal (obligatorio para eventos DIAN).
 */
class EmpresaConfig extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';   // misma BD que todo
    protected $table = 'empresa_config';

    protected $fillable = [
        'empresa_id',
        'iva_incluido', 'usa_fe', 'usa_caja', 'resolucion_fe', 'resolucion_fecha', 'prefijo_fe',
        'rango_desde', 'rango_hasta', 'iniciar_factura_en', 'moneda',
        'agente_retenedor', 'autorizar_devoluciones', 'autorizar_anulaciones',
        'permitir_facturar_negativo', 'usar_familias', 'usar_lotes',
        'imprimir_cotizacion', 'logo_path',
        'representante_tipo_doc_id', 'representante_numero', 'representante_dv',
        'representante_primer_nombre', 'representante_segundo_nombre',
        'representante_primer_apellido', 'representante_segundo_apellido',
        'representante_cargo', 'representante_area',
    ];

    protected $casts = [
        'iva_incluido'               => 'boolean',
        'usa_fe'                     => 'boolean',
        'usa_caja'                   => 'boolean',
        'agente_retenedor'           => 'boolean',
        'autorizar_devoluciones'     => 'boolean',
        'autorizar_anulaciones'      => 'boolean',
        'permitir_facturar_negativo' => 'boolean',
        'usar_familias'              => 'boolean',
        'usar_lotes'                 => 'boolean',
        'imprimir_cotizacion'        => 'boolean',
        'resolucion_fecha'           => 'date',
        'rango_desde'                => 'integer',
        'rango_hasta'                => 'integer',
        'iniciar_factura_en'         => 'integer',
    ];
}
