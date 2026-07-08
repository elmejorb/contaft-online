<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;

/**
 * Retenciones que la empresa aplica (ReteFuente 06, ReteIVA 05, ReteICA 07).
 * Cada empresa configura sus tarifas y bases mínimas.
 */
class Retencion extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'retenciones';
    public $timestamps = false;

    protected $fillable = [
        'empresa_id', 'codigo', 'nombre', 'codigo_dian',
        'porcentaje', 'base_desde', 'tipo_calculo', 'activo',
    ];

    protected $casts = [
        'porcentaje' => 'decimal:3',
        'base_desde' => 'decimal:2',
        'activo'     => 'boolean',
    ];
}
