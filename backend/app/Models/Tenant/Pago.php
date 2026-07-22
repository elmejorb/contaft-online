<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pago/abono aplicado a una venta a crédito (cartera).
 *
 * REGLA CRÍTICA (lección del desktop, Ammi 4.3.63): al calcular saldo, el
 * `descuento` va SUMADO a `valor` — un pago con descuento salda más de lo que
 * ingresó en caja. La vista vw_facturas_saldo ya lo hace (SUM(valor + descuento)).
 * Los pagos anulados (estado='anulada') se excluyen de cartera.
 */
class Pago extends Model
{
    use BelongsToEmpresa;

    // La tabla pagos solo tiene created_at (default CURRENT_TIMESTAMP), no updated_at.
    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'pagos';

    protected $fillable = [
        'empresa_id', 'consecutivo', 'fecha', 'cliente_id', 'venta_id',
        'medio_pago_id', 'valor', 'descuento', 'retencion', 'detalle',
        'usuario_id', 'caja_sesion_id', 'estado', 'anulado_at', 'anulado_por', 'anulado_motivo',
    ];

    protected $casts = [
        'fecha'      => 'datetime',
        'valor'      => 'decimal:2',
        'descuento'  => 'decimal:2',
        'retencion'  => 'decimal:2',
        'anulado_at' => 'datetime',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }
}
