<?php

namespace App\Models\Landlord;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;

/**
 * Planes de suscripción del SaaS: Prueba, Básico, Pro, Empresarial.
 * Vive en la BD del landlord (u408713046_dbcontaft).
 */
class Plan extends Model
{
    protected $connection = 'landlord';
    protected $table = 'planes';

    protected $fillable = [
        'nombre', 'slug', 'precio_mensual', 'max_empresas', 'max_ventas_mes',
        'max_usuarios', 'max_productos', 'features', 'activo', 'orden',
    ];

    protected $casts = [
        'precio_mensual' => 'decimal:2',
        'features'       => 'array',   // JSON → array PHP
        'activo'         => 'boolean',
    ];

    /**
     * ¿Este plan incluye la feature X?
     * Ejemplo: $plan->hasFeature('fe_dian')  → true/false
     */
    public function hasFeature(string $key): bool
    {
        return (bool) ($this->features[$key] ?? false);
    }
}
