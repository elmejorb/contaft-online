<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;

/**
 * Medios de pago GLOBALES (no llevan empresa_id).
 *
 * `codigo_dian` mapea cada medio operativo al catálogo de la FE:
 *   10=Efectivo · 11=Transferencia · 12=Cheque · 13=Tarjeta débito · 14=Tarjeta crédito
 *
 * Los medios "de marca" (Bancolombia, Nequi, Daviplata) son SUBCATEGORÍAS
 * operativas: su nombre sirve para caja/reportes, pero todos apuntan al mismo
 * código DIAN (11=Transferencia), que es lo que se envía en la factura electrónica.
 */
class MedioPago extends Model
{
    protected $connection = 'landlord';
    protected $table = 'medios_pago';

    protected $fillable = ['nombre', 'tipo', 'codigo_dian', 'orden', 'activo'];

    protected $casts = [
        'orden'  => 'integer',
        'activo' => 'boolean',
    ];
}
