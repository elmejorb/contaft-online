<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Familia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD de familias / categorías. Soporta árbol vía padre_id.
 */
class FamiliaController extends Controller
{
    /**
     * GET /api/familias?tree=1  Devuelve todo el árbol (raíces con hijos anidados).
     * GET /api/familias         Lista plana ordenada por (padre_id, orden).
     */
    public function index(Request $request): JsonResponse
    {
        $q = Familia::query()->where('activo', true)->orderBy('orden')->orderBy('nombre');

        if ($request->boolean('tree')) {
            $all = $q->get();
            $byPadre = $all->groupBy('padre_id');
            $armar = function ($padreId) use (&$armar, $byPadre) {
                return ($byPadre->get($padreId) ?? collect())->map(fn($f) => [
                    'id'       => $f->id,
                    'codigo'   => $f->codigo,
                    'nombre'   => $f->nombre,
                    'orden'    => $f->orden,
                    'hijos'    => $armar($f->id),
                ])->values();
            };
            return response()->json(['tree' => $armar(null)]);
        }

        return response()->json(['familias' => $q->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'codigo'   => 'nullable|string|max:20',
            'nombre'   => 'required|string|max:100',
            'padre_id' => 'nullable|integer|exists:landlord.familias,id',
            'orden'    => 'nullable|integer',
            'activo'   => 'sometimes|boolean',
        ]);
        $familia = Familia::create($data);
        return response()->json(['familia' => $familia], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $familia = Familia::findOrFail($id);
        $data = $request->validate([
            'codigo'   => 'nullable|string|max:20',
            'nombre'   => 'required|string|max:100',
            'padre_id' => 'nullable|integer|different:id|exists:landlord.familias,id',
            'orden'    => 'nullable|integer',
            'activo'   => 'sometimes|boolean',
        ]);
        $familia->update($data);
        return response()->json(['familia' => $familia->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        $familia = Familia::findOrFail($id);
        if ($familia->hijos()->exists()) {
            return response()->json([
                'error' => 'La familia tiene subcategorías. Elimina o mueve las hijas primero.',
            ], 422);
        }
        if ($familia->productos()->exists()) {
            return response()->json([
                'error' => 'La familia tiene productos asignados. Reasígnalos antes de eliminar.',
            ], 422);
        }
        $familia->update(['activo' => false]);
        return response()->json(['message' => 'Familia desactivada']);
    }
}
