<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Contactos de notificación del proveedor — emails Cc a los que se envía
 * copia del comprobante de pago o del DS emitido. Mismo patrón que el
 * cliente pero para el lado de compras.
 */
class ProveedorContactoNotificacion extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'proveedor_contactos_notificacion';

    protected $fillable = [
        'empresa_id', 'proveedor_id', 'tipo', 'nombre', 'cargo',
        'correo', 'telefono', 'nota', 'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }
}
