<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sesión de caja (apertura → operación → cierre con cuadre).
 * Los acumulados se persisten al CERRAR; durante la sesión se calculan al vuelo
 * agregando ventas/pagos/movimientos con caja_sesion_id = esta sesión.
 *
 * Efectivo esperado = base_inicial + ventas_contado_efectivo + pagos_efectivo
 *                     - egresos - anulaciones - retiros_parciales
 * Diferencia = conteo_final - total_efectivo_sistema
 */
class CajaSesion extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'caja_sesiones';

    protected $fillable = [
        'empresa_id', 'caja_id', 'usuario_id', 'fecha_apertura', 'fecha_cierre',
        'base_inicial', 'ventas_contado_efectivo', 'ventas_contado_transf', 'ventas_credito',
        'pagos_efectivo', 'pagos_transf', 'egresos', 'anulaciones', 'retiros_parciales',
        'total_efectivo_sistema', 'conteo_final', 'diferencia_final', 'estado', 'observacion',
    ];

    protected $casts = [
        'fecha_apertura'          => 'datetime',
        'fecha_cierre'            => 'datetime',
        'base_inicial'            => 'decimal:2',
        'ventas_contado_efectivo' => 'decimal:2',
        'ventas_contado_transf'   => 'decimal:2',
        'ventas_credito'          => 'decimal:2',
        'pagos_efectivo'          => 'decimal:2',
        'pagos_transf'            => 'decimal:2',
        'egresos'                 => 'decimal:2',
        'anulaciones'             => 'decimal:2',
        'retiros_parciales'       => 'decimal:2',
        'total_efectivo_sistema'  => 'decimal:2',
        'conteo_final'            => 'decimal:2',
        'diferencia_final'        => 'decimal:2',
    ];

    public function caja(): BelongsTo
    {
        return $this->belongsTo(Caja::class);
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(CajaMovimiento::class);
    }
}
