<?php

namespace App\Scopes;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global Scope que agrega `WHERE empresa_id = X` a toda query de modelos
 * que usen el trait BelongsToEmpresa. X = empresa activa del request.
 *
 * Si no hay empresa activa (request sin autenticar, artisan CLI, etc.)
 * NO se aplica el filtro para no romper seeders, tests, comandos, etc.
 * En ese caso el desarrollador debe filtrar manualmente si es necesario.
 */
class EmpresaScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $empresaId = BelongsToEmpresa::empresaIdActual();
        if ($empresaId === null) {
            // Sin contexto de empresa → no filtrar (permite seeders/CLI)
            return;
        }
        // Con alias correcto usando la tabla del modelo (evita ambigüedad en JOINs)
        $builder->where($model->qualifyColumn('empresa_id'), $empresaId);
    }
}
