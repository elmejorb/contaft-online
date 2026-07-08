<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Familia / categoría de productos (soporta árbol vía padre_id).
 */
class Familia extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'familias';
    public $timestamps = false;   // no tiene created_at/updated_at

    protected $fillable = [
        'empresa_id', 'codigo', 'nombre', 'padre_id', 'orden', 'activo',
    ];

    protected $casts = [
        'orden'  => 'integer',
        'activo' => 'boolean',
    ];

    public function padre(): BelongsTo
    {
        return $this->belongsTo(self::class, 'padre_id');
    }

    public function hijos(): HasMany
    {
        return $this->hasMany(self::class, 'padre_id');
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class, 'familia_id');
    }
}
