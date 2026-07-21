<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;

/**
 * Movimiento de caja. tipo:
 *   retiro_parcial | traslado | deposito | gasto
 * Un traslado/retiro mueve efectivo entre caja_origen y caja_destino.
 */
class CajaMovimiento extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'caja_movimientos';

    protected $fillable = [
        'empresa_id', 'caja_sesion_id', 'caja_origen_id', 'caja_destino_id',
        'usuario_id', 'fecha', 'valor', 'tipo', 'descripcion',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'valor' => 'decimal:2',
    ];
}
