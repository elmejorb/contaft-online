<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;

/**
 * Medios de pago GLOBALES (no llevan empresa_id — son los mismos para todos
 * los tenants: Efectivo, Tarjeta, Bancolombia, Nequi, Daviplata, Cheque).
 * Se pueden extender en el futuro con configuración por empresa si aplica.
 */
class MedioPago extends Model
{
    protected $connection = 'landlord';
    protected $table = 'medios_pago';

    protected $fillable = ['nombre', 'tipo', 'orden', 'activo'];

    protected $casts = [
        'orden'  => 'integer',
        'activo' => 'boolean',
    ];
}
