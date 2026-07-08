<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Emails Cc que reciben copia cuando se envía la factura del cliente
 * por correo. NO se guardan en el XML DIAN ni aparecen en el PDF —
 * solo son destinatarios "de cortesía" para contadores, gerentes, etc.
 *
 * Aislamiento por empresa_id via BelongsToEmpresa. Cascada al borrar
 * cliente (los contactos no tienen sentido sin él).
 */
class ClienteContactoNotificacion extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'cliente_contactos_notificacion';

    protected $fillable = [
        'empresa_id', 'cliente_id', 'tipo', 'nombre', 'cargo',
        'correo', 'telefono', 'nota', 'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }
}
