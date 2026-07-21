<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Caja registradora. tipo:
 *   - punto_venta: operativa, con sesiones (apertura/cierre).
 *   - principal: administrativa, sin sesiones; recibe traslados y movimientos.
 * `usuario_id` = cajero asignado (opcional); si se asigna, ese usuario solo
 * opera esa caja.
 */
class Caja extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'cajas';

    protected $fillable = ['empresa_id', 'nombre', 'tipo', 'usuario_id', 'saldo', 'activa'];

    protected $casts = [
        'saldo'  => 'decimal:2',
        'activa' => 'boolean',
    ];

    public function sesiones(): HasMany
    {
        return $this->hasMany(CajaSesion::class);
    }

    public function esPrincipal(): bool
    {
        return $this->tipo === 'principal';
    }
}
