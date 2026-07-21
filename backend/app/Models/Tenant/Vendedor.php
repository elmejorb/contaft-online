<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;

/**
 * Vendedor de una empresa. Puede vincularse a un usuario (usuario_id) para
 * el POS móvil / comisiones. Aislamiento por empresa_id.
 */
class Vendedor extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'vendedores';

    protected $fillable = [
        'empresa_id', 'usuario_id', 'nombre', 'telefono', 'comision_pct', 'zona', 'activo',
    ];

    protected $casts = [
        'comision_pct' => 'decimal:2',
        'activo'       => 'boolean',
    ];
}
