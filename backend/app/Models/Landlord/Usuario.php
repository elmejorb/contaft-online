<?php

namespace App\Models\Landlord;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Usuario del SaaS. Puede pertenecer a una o más empresas (típicamente un
 * contador que administra varias). Se autentica contra el landlord;
 * cuando entra, el TenantMiddleware resuelve qué BD tenant usar según la
 * empresa activa.
 */
class Usuario extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $connection = 'landlord';
    protected $table = 'usuarios';

    protected $fillable = [
        'email', 'password_hash', 'nombre', 'telefono',
        'email_verificado_at', 'activo', 'remember_token',
    ];

    protected $hidden = ['password_hash', 'remember_token'];

    protected $casts = [
        'email_verificado_at' => 'datetime',
        'ultimo_login_at'     => 'datetime',
        'activo'              => 'boolean',
    ];

    /**
     * Laravel espera getAuthPassword() para verificar el password_hash.
     * Como usamos `password_hash` en vez de `password`, override.
     */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    // === Relaciones ===
    public function empresas(): BelongsToMany
    {
        return $this->belongsToMany(Empresa::class, 'usuarios_empresas', 'usuario_id', 'empresa_id')
            ->withPivot('rol', 'empresa_default', 'activo')
            ->withTimestamps();
    }

    /**
     * Empresa marcada como default para este usuario, o la primera activa.
     */
    public function empresaDefault(): ?Empresa
    {
        return $this->empresas()
            ->wherePivot('activo', 1)
            ->orderByPivot('empresa_default', 'desc')
            ->orderBy('id')
            ->first();
    }
}
