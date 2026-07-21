<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Caja;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD de cajas registradoras (Subfase 1). La operación de sesiones
 * (abrir/cerrar/cuadre) y movimientos vive en CajaSesionController (Subfase 2/3).
 */
class CajaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Caja::query()->orderBy('tipo')->orderBy('nombre');
        if ($request->filled('activa')) $q->where('activa', $request->boolean('activa'));
        return response()->json(['cajas' => $q->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $this->validarPrincipalUnica($request, null);
        return response()->json(['caja' => Caja::create($data)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $caja = Caja::findOrFail($id);
        $data = $this->validated($request, $caja);
        $this->validarPrincipalUnica($request, $caja->id);
        $caja->update($data);
        return response()->json(['caja' => $caja->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        $caja = Caja::findOrFail($id);
        // Nunca borrar físicamente (puede tener sesiones/movimientos históricos).
        $caja->update(['activa' => false]);
        return response()->json(['message' => 'Caja desactivada']);
    }

    protected function validated(Request $request, ?Caja $caja = null): array
    {
        $empresaId = $request->attributes->get('empresa')->id;
        return $request->validate([
            'nombre'     => ['required', 'string', 'max:60',
                Rule::unique('landlord.cajas', 'nombre')
                    ->where(fn($q) => $q->where('empresa_id', $empresaId))
                    ->ignore($caja?->id)],
            'tipo'       => 'required|in:punto_venta,principal',
            'usuario_id' => 'nullable|integer',
            'activa'     => 'sometimes|boolean',
        ]);
    }

    /** Solo puede existir UNA caja principal por empresa. */
    protected function validarPrincipalUnica(Request $request, ?int $ignoreId): void
    {
        if ($request->input('tipo') !== 'principal') return;
        $existe = Caja::where('tipo', 'principal')
            ->when($ignoreId, fn($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
        if ($existe) {
            abort(response()->json([
                'message' => 'Ya existe una caja principal. Solo se permite una por empresa.',
                'errors'  => ['tipo' => ['Ya hay una caja principal']],
            ], 422));
        }
    }
}
