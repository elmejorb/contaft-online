<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Venta / documento de venta. Aislamiento por empresa_id vía BelongsToEmpresa.
 *
 * tipo_documento: pos | electronica | soporte | cotizacion
 *   - cotizacion NO afecta inventario/kardex/cartera (es una propuesta).
 * tipo_termino: contado | credito
 * estado: valida | anulada | borrador  (las anuladas se excluyen de cartera)
 *
 * Numeración: `numero` es consecutivo POR (empresa_id, tipo_documento).
 * Los totales se calculan SIEMPRE en el servidor (VentaCalculator) — nunca
 * se confía en los que mande el frontend.
 *
 * Campos DIAN (se llenan al emitir FE, Subfase 4): prefijo_fe, numero_fe, cufe,
 * payment_form_id (1=contado, 2=crédito), payment_due_days, payment_method_id.
 */
class Venta extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'ventas';

    protected $fillable = [
        'empresa_id', 'numero', 'tipo_documento', 'tipo_termino', 'dias_credito',
        'fecha', 'cliente_id', 'vendedor_id', 'lista_precio', 'descuento_global',
        'subtotal', 'total_iva', 'total', 'comentario',
        'medio_pago_id', 'efectivo', 'transferencia', 'cambio', 'abono_inicial',
        'payment_form_id', 'payment_method_id', 'payment_due_days',
        'prefijo_fe', 'numero_fe', 'cufe', 'cufe_url_qr', 'dian_estado', 'dian_response',
        'enviada_dian_at', 'email_enviado', 'email_enviado_at',
        'estado', 'anulada_at', 'anulada_por', 'anulada_motivo',
        'usuario_id', 'autorizado_por', 'en_contingencia', 'contingencia_motivo',
        'caja_sesion_id',
    ];

    protected $casts = [
        'fecha'            => 'datetime',
        'dias_credito'     => 'integer',
        'lista_precio'     => 'integer',
        'descuento_global' => 'decimal:2',
        'subtotal'         => 'decimal:2',
        'total_iva'        => 'decimal:2',
        'total'            => 'decimal:2',
        'efectivo'         => 'decimal:2',
        'transferencia'    => 'decimal:2',
        'cambio'           => 'decimal:2',
        'abono_inicial'    => 'decimal:2',
        'email_enviado'    => 'boolean',
        'en_contingencia'  => 'boolean',
        'enviada_dian_at'  => 'datetime',
        'email_enviado_at' => 'datetime',
        'anulada_at'       => 'datetime',
    ];

    public function lineas(): HasMany
    {
        return $this->hasMany(VentaLinea::class);
    }

    public function retenciones(): HasMany
    {
        return $this->hasMany(VentaRetencion::class);
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class);
    }

    public function esCotizacion(): bool
    {
        return $this->tipo_documento === 'cotizacion';
    }

    public function afectaInventario(): bool
    {
        return $this->tipo_documento !== 'cotizacion';
    }
}
