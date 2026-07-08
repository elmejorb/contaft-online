<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Producto del inventario. Los precios llevan IVA incluido cuando
 * empresa_config.iva_incluido = 1 (default para Colombia).
 */
class Producto extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'productos';

    protected $fillable = [
        'empresa_id', 'codigo', 'codigo_barras', 'nombre', 'descripcion',
        'familia_id', 'unidad_medida_id',
        'es_servicio', 'tiene_componentes', 'tiene_lotes',
        'precio_costo', 'precio_venta_1', 'precio_venta_2', 'precio_venta_3',
        'precio_minimo',
        'iva_pct', 'existencia', 'existencia_minima',
        'ubicacion', 'etiqueta', 'proveedor_id', 'imagen_path', 'notas', 'activo',
    ];

    protected $casts = [
        'es_servicio'       => 'boolean',
        'tiene_componentes' => 'boolean',
        'tiene_lotes'       => 'boolean',
        'precio_costo'      => 'decimal:4',
        'precio_venta_1'    => 'decimal:4',
        'precio_venta_2'    => 'decimal:4',
        'precio_venta_3'    => 'decimal:4',
        'precio_minimo'     => 'decimal:4',
        'iva_pct'           => 'decimal:2',
        'existencia'        => 'decimal:3',
        'existencia_minima' => 'decimal:3',
        'activo'            => 'boolean',
    ];

    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class);
    }
}
