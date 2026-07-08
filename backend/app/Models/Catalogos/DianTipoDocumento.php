<?php

namespace App\Models\Catalogos;

use Illuminate\Database\Eloquent\Model;

/**
 * Catálogos globales DIAN (sin empresa_id). Todos los tenants leen los mismos.
 * Se poblaron una vez desde sql/03-catalogos-dian.sql — Resolución 000042.
 */
class DianTipoDocumento extends Model
{
    protected $connection = 'landlord';
    protected $table = 'dian_tipos_documento';
    public $timestamps = false;
    protected $fillable = ['codigo', 'nombre', 'orden'];
}
