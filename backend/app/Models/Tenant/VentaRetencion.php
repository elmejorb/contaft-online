<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Retención aplicada a una venta (ReteFuente/ReteIVA/ReteICA).
 * modo: inf (informativa) | gross_up (reescala el subtotal para netear).
 */
class VentaRetencion extends Model
{
    use BelongsToEmpresa;

    public $timestamps = false;

    protected $connection = 'landlord';
    protected $table = 'venta_retenciones';

    protected $fillable = [
        'empresa_id', 'venta_id', 'retencion_id', 'porcentaje', 'base', 'valor', 'modo',
    ];

    protected $casts = [
        'porcentaje' => 'decimal:3',
        'base'       => 'decimal:2',
        'valor'      => 'decimal:2',
    ];

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function retencion(): BelongsTo
    {
        return $this->belongsTo(Retencion::class);
    }
}
