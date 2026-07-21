<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Catálogos globales DIAN. Endpoint público (no requiere token) porque
 * el frontend los usa antes de estar autenticado (ej. en signup).
 *
 *   GET /api/catalogos               → dump completo (todos los tipos)
 *   GET /api/catalogos/municipios    → todos los municipios (paginable)
 *   GET /api/catalogos/municipios?departamento_id=25
 */
class CatalogoController extends Controller
{
    /**
     * Devuelve todos los catálogos "cortos" en un solo response.
     * El frontend los cachea en memoria por sesión.
     */
    public function index(): JsonResponse
    {
        $conn = DB::connection('landlord');
        return response()->json([
            'tipos_documento'       => $conn->table('dian_tipos_documento')
                                            ->orderBy('orden')->get(),
            'tipos_organizacion'    => $conn->table('dian_tipos_organizacion')
                                            ->orderBy('id')->get(),
            'tipos_responsabilidad' => $conn->table('dian_tipos_responsabilidad')
                                            ->orderBy('orden')->get(),
            'tipos_regimen'         => $conn->table('dian_tipos_regimen')
                                            ->orderBy('id')->get(),
            'tipos_adquirente'      => $conn->table('dian_tipos_adquirente')
                                            ->orderBy('id')->get(),
            'departamentos'         => $conn->table('dian_departamentos')
                                            ->orderBy('nombre')->get(),
        ]);
    }

    /**
     * Municipios — potencialmente muchos (~1122). Filtrable por
     * departamento_id (recomendado) y por búsqueda de nombre.
     */
    public function municipios(Request $request): JsonResponse
    {
        $q = DB::connection('landlord')->table('dian_municipios');
        if ($request->filled('departamento_id')) {
            $q->where('departamento_id', $request->integer('departamento_id'));
        }
        if ($busq = trim((string) $request->query('q', ''))) {
            $q->where('nombre', 'LIKE', "%{$busq}%");
        }
        return response()->json(['municipios' => $q->orderBy('nombre')->limit(200)->get()]);
    }

    /**
     * Unidades de medida DIAN (~1093). Requeridas para facturación
     * electrónica (unitCode en cada línea). Los IDs coinciden con la tabla
     * unit_measures de api-electronica. La unidad estándar es id 70 (código 94).
     * Se devuelven todas (el front las cachea por sesión).
     */
    public function unidades(): JsonResponse
    {
        return response()->json([
            'unidades' => DB::connection('landlord')
                ->table('dian_unidades_medida')
                ->select('id', 'codigo', 'nombre', 'comun')
                // Las de uso común (Unidad, Kilogramo, Litro…) primero y por su
                // orden curado; el resto del catálogo DIAN después, alfabético.
                ->orderByDesc('comun')
                ->orderBy('orden')
                ->orderBy('nombre')
                ->get(),
        ]);
    }
}
