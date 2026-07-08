<?php

namespace App\Models\Concerns;

use App\Scopes\EmpresaScope;
use Illuminate\Support\Facades\Auth;
use Illuminate\Container\Container;
use Illuminate\Http\Request;

/**
 * Trait para modelos TENANT (row-level multi-tenant).
 *
 * Uso:
 *   class Cliente extends Model {
 *       use BelongsToEmpresa;   // ← agrega esto
 *       protected $connection = 'landlord';
 *       protected $table      = 'clientes';
 *   }
 *
 * Efecto:
 *   * Al hacer Cliente::all() automáticamente añade WHERE empresa_id = X
 *   * Al crear un Cliente nuevo, setea empresa_id = X automáticamente
 *   * X viene del request actual (empresa activa del usuario autenticado)
 *
 * De este modo un desarrollador NUNCA tiene que acordarse de filtrar por
 * empresa — el scope global lo hace. Es imposible traer datos cruzados
 * por accidente.
 *
 * Para bypass explícito (super-admin) se usa `->withoutGlobalScope(EmpresaScope::class)`.
 */
trait BelongsToEmpresa
{
    protected static function bootBelongsToEmpresa(): void
    {
        // Filtro global en todas las queries
        static::addGlobalScope(new EmpresaScope);

        // Autopoblar empresa_id al crear un modelo nuevo
        static::creating(function ($model) {
            if (empty($model->empresa_id)) {
                $empresaId = static::empresaIdActual();
                if ($empresaId) {
                    $model->empresa_id = $empresaId;
                }
            }
        });
    }

    /**
     * Devuelve el ID de la empresa activa en el request actual.
     * Es puesto por ResolveTenant middleware.
     */
    public static function empresaIdActual(): ?int
    {
        try {
            /** @var Request $req */
            $req = Container::getInstance()->make('request');
            $empresa = $req->attributes->get('empresa');
            return $empresa?->id;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
