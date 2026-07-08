<?php

namespace App\Models\Tenant;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Cliente de una empresa. Aislamiento por empresa_id vía BelongsToEmpresa.
 *
 * Campos DIAN (para FE):
 *   - tipo_documento_id     → dian_tipos_documento (13=CC, 31=NIT, 41=Passp)
 *   - identificacion + dv   → NIT/CC + dígito verificación
 *   - liability_id          → dian_tipos_responsabilidad (Gran contribuyente, etc.)
 *   - regimen_id            → dian_tipos_regimen (Responsable IVA / No responsable)
 *   - tipo_adquirente_id    → dian_tipos_adquirente (Estándar/AIU/Mandatos)
 *   - municipio_id          → dian_municipios (código DANE)
 *   - departamento_id       → cache del municipio (para búsqueda cascada UI)
 */
class Cliente extends Model
{
    use BelongsToEmpresa;

    protected $connection = 'landlord';
    protected $table = 'clientes';

    protected $fillable = [
        'empresa_id', 'codigo', 'razon_social', 'tipo_persona',
        'tipo_documento_id', 'identificacion', 'dv', 'matricula_mercantil',
        'nombre_comercial',
        'email', 'telefono', 'whatsapp', 'direccion',
        'municipio_id', 'departamento_id',
        'regimen_id', 'liability_id', 'tipo_adquirente_id',
        'cupo_credito', 'dias_credito',
        'fecha_cumpleanos', 'observaciones', 'retenciones', 'activo',
    ];

    protected $casts = [
        'cupo_credito'     => 'decimal:2',
        'dias_credito'     => 'integer',
        'fecha_cumpleanos' => 'date',
        'retenciones'      => 'array',
        'activo'           => 'boolean',
    ];

    public function contactosNotificacion(): HasMany
    {
        return $this->hasMany(ClienteContactoNotificacion::class);
    }

    /**
     * Calcula el DV (Dígito de Verificación DIAN) desde una identificación.
     * Algoritmo oficial: multiplicar por primos y % 11.
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
