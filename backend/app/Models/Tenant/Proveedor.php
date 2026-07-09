<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Proveedor de una empresa. Aislamiento por empresa_id via BelongsToEmpresa.
 *
 * El campo `tipo_soporte` decide cómo se soporta cada compra:
 *   - fe_recibida       → el proveedor emite FE/POS y tú la capturas.
 *   - documento_soporte → tú emites Documento Soporte DIAN a su nombre.
 *
 * Comparte los mismos catálogos DIAN que Cliente
 * (tipos_documento, regimen, responsabilidad, dept/muni).
 */
class Proveedor extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'proveedores';

    protected $fillable = [
        'empresa_id',
        'codigo', 'razon_social', 'nombre_comercial', 'tipo_persona',
        'tipo_documento_id', 'identificacion', 'dv', 'matricula_mercantil',
        'email', 'telefono', 'whatsapp', 'direccion',
        'departamento_id', 'municipio_id',
        'regimen_id', 'liability_id', 'no_obligado_facturar',
        'tipo_soporte',
        'retencion_fuente_pct', 'retencion_iva_pct', 'retencion_ica_pct',
        'concepto_dian',
        'banco_nombre', 'banco_tipo_cuenta', 'banco_numero_cuenta',
        'cupo_credito', 'dias_credito',
        'observaciones', 'activo',
    ];

    protected $casts = [
        'no_obligado_facturar' => 'boolean',
        'retencion_fuente_pct' => 'decimal:2',
        'retencion_iva_pct'    => 'decimal:2',
        'retencion_ica_pct'    => 'decimal:2',
        'cupo_credito'         => 'decimal:2',
        'dias_credito'         => 'integer',
        'activo'               => 'boolean',
    ];

    public function contactosNotificacion(): HasMany
    {
        return $this->hasMany(ProveedorContactoNotificacion::class);
    }

    /**
     * DV oficial DIAN. Duplica algoritmo del cliente — se puede compartir en
     * un trait después si aparece un tercer modelo con identificación.
     */
    public static function calcularDv(string $identificacion): ?string
    {
        $num = preg_replace('/\D/', '', $identificacion);
        if ($num === '' || strlen($num) > 15) return null;
        $primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
        $suma = 0;
        $digits = array_reverse(str_split($num));
        foreach ($digits as $i => $d) {
            if ($i >= count($primos)) break;
            $suma += intval($d) * $primos[$i];
        }
        $mod = $suma % 11;
        return $mod >= 2 ? (string) (11 - $mod) : (string) $mod;
    }
}
