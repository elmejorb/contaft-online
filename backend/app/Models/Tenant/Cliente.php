<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;

/**
 * Cliente de una empresa. Aislamiento por empresa_id vía BelongsToEmpresa.
 */
class Cliente extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'clientes';

    protected $fillable = [
        'empresa_id', 'codigo', 'razon_social', 'tipo_persona',
        'tipo_documento_id', 'identificacion', 'dv', 'nombre_comercial',
        'email', 'telefono', 'whatsapp', 'direccion', 'municipio_id',
        'regimen_id', 'liability_id', 'cupo_credito', 'dias_credito',
        'fecha_cumpleanos', 'observaciones', 'retenciones', 'activo',
    ];

    protected $casts = [
        'cupo_credito'     => 'decimal:2',
        'dias_credito'     => 'integer',
        'fecha_cumpleanos' => 'date',
        'retenciones'      => 'array',   // JSON → array
        'activo'           => 'boolean',
    ];
}
