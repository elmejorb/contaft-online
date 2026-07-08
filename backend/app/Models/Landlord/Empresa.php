<?php

namespace App\Models\Landlord;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * Empresa cliente registrada en el SaaS. Cada empresa apunta a su propia
 * BD (bd_name) donde viven sus datos operativos (ventas, clientes, kardex).
 */
class Empresa extends Model
{
    protected $connection = 'landlord';
    protected $table = 'empresas';

    protected $fillable = [
        'razon_social', 'nit', 'dv', 'email_contacto', 'telefono', 'direccion',
        'municipio_id', 'tipo_organizacion_id', 'tipo_regimen_id', 'tipo_documento_id',
        'bd_name', 'plan_id', 'trial_hasta', 'suscripcion_hasta',
        'activa', 'suspendida_motivo', 'logo_url',
        'api_electronica_id', 'api_electronica_email', 'api_electronica_pass',
    ];

    protected $casts = [
        'trial_hasta'       => 'date',
        'suscripcion_hasta' => 'date',
        'activa'            => 'boolean',
    ];

    protected $hidden = ['api_electronica_pass'];

    /**
     * Genera un bd_name seguro a partir de una razón social:
     *   "AMMI ACCESORIOS S.A.S"  →  "u408713046_cli_ammi_accesorios"
     * Garantiza unicidad agregando sufijo numérico si colisiona.
     */
    public static function generarBdName(string $razonSocial): string
    {
        $prefix = env('TENANT_DB_PREFIX', 'u408713046_cli_');
        $slug = Str::slug($razonSocial, '_');
        $slug = substr($slug, 0, 40);  // MariaDB limita nombres a 64, dejamos margen para sufijo
        $base = $prefix . $slug;

        $candidate = $base;
        $i = 1;
        while (self::where('bd_name', $candidate)->exists()) {
            $candidate = $base . '_' . $i;
            $i++;
        }
        return $candidate;
    }

    // === Relaciones ===
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    public function usuarios(): BelongsToMany
    {
        return $this->belongsToMany(Usuario::class, 'usuarios_empresas', 'empresa_id', 'usuario_id')
            ->withPivot('rol', 'empresa_default', 'activo')
            ->withTimestamps();
    }

    public function subscripciones(): HasMany
    {
        return $this->hasMany(Subscripcion::class);
    }

    // === Helpers ===

    /**
     * ¿Está en período de trial? (activa Y trial_hasta ≥ hoy Y sin suscripción pagada).
     */
    public function enTrial(): bool
    {
        return $this->activa
            && $this->trial_hasta !== null
            && $this->trial_hasta->gte(now()->toDateString())
            && ($this->suscripcion_hasta === null || $this->suscripcion_hasta->lt(now()->toDateString()));
    }

    /**
     * ¿La empresa puede operar hoy? (activa Y suscripción/trial vigente).
     */
    public function puedeOperar(): bool
    {
        if (!$this->activa) return false;
        $hoy = now()->toDateString();
        if ($this->suscripcion_hasta !== null && $this->suscripcion_hasta->gte($hoy)) return true;
        if ($this->trial_hasta !== null && $this->trial_hasta->gte($hoy)) return true;
        return false;
    }
}
