<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Movimiento de KARDEX — INMUTABLE. Nunca se hace UPDATE ni DELETE sobre una
 * fila existente (lección del desktop: docs/ARQUITECTURA.md §6). Las
 * correcciones se hacen con asientos opuestos (tipo 'reverso' / 'anulacion').
 *
 * tipo: entrada | salida | ajuste | reverso | anulacion
 * referencia_tipo/id: documento origen (p.ej. 'venta' + venta_id).
 * saldo_cantidad/saldo_costo: saldo acumulado del producto tras el movimiento.
 */
class Kardex extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'kardex';

    protected $fillable = [
        'empresa_id', 'fecha', 'producto_id', 'tipo', 'concepto',
        'referencia_tipo', 'referencia_id',
        'cantidad_entrada', 'cantidad_salida', 'costo_unitario', 'costo_movimiento',
        'saldo_cantidad', 'saldo_costo', 'usuario_id',
    ];

    protected $casts = [
        'fecha'            => 'datetime',
        'cantidad_entrada' => 'decimal:3',
        'cantidad_salida'  => 'decimal:3',
        'costo_unitario'   => 'decimal:4',
        'costo_movimiento' => 'decimal:2',
        'saldo_cantidad'   => 'decimal:3',
        'saldo_costo'      => 'decimal:2',
    ];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
