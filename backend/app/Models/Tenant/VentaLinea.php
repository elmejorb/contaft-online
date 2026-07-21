<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Línea de una venta. Los montos ya vienen calculados por VentaCalculator
 * (con IVA extraído y gross-up de retención aplicado cuando corresponde).
 *
 * descripcion_temp: solo para servicios/ítems con texto editable (no descuenta
 * inventario). producto_id siempre apunta a un producto real.
 */
class VentaLinea extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'venta_lineas';

    protected $fillable = [
        'empresa_id', 'venta_id', 'linea_num', 'producto_id', 'descripcion_temp',
        'cantidad', 'precio_costo', 'precio_venta', 'iva_pct', 'iva_monto',
        'descuento_monto', 'subtotal', 'total_linea',
    ];

    protected $casts = [
        'linea_num'       => 'integer',
        'cantidad'        => 'decimal:3',
        'precio_costo'    => 'decimal:4',
        'precio_venta'    => 'decimal:4',
        'iva_pct'         => 'decimal:2',
        'iva_monto'       => 'decimal:2',
        'descuento_monto' => 'decimal:2',
        'subtotal'        => 'decimal:2',
        'total_linea'     => 'decimal:2',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
