<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Cliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD de clientes de la empresa activa.
 * El aislamiento por empresa_id es automático vía BelongsToEmpresa +
 * EmpresaScope global — este controller NO filtra manualmente.
 */
class ClienteController extends Controller
{
    /**
     * GET /api/clientes?q=&activo=1&page=1&per_page=25
     */
    public function index(Request $request): JsonResponse
    {
        $q = Cliente::query();

        if ($busq = trim((string) $request->query('q', ''))) {
            $q->where(function ($w) use ($busq) {
                $w->where('razon_social', 'LIKE', "%{$busq}%")
                  ->orWhere('identificacion', 'LIKE', "%{$busq}%")
                  ->orWhere('email', 'LIKE', "%{$busq}%")
                  ->orWhere('telefono', 'LIKE', "%{$busq}%");
            });
        }
        if ($request->filled('activo')) {
            $q->where('activo', $request->boolean('activo'));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        return response()->json($q->orderBy('razon_social')->paginate($perPage));
    }

    public function show(int $id): JsonResponse
    {
        $cliente = Cliente::findOrFail($id);
        return response()->json(['cliente' => $cliente]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        // BelongsToEmpresa autopobla empresa_id
        $cliente = Cliente::create($data);
        return response()->json(['cliente' => $cliente], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $cliente = Cliente::findOrFail($id);
        $data = $this->validated($request, $cliente);
        $cliente->update($data);
        return response()->json(['cliente' => $cliente->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        $cliente = Cliente::findOrFail($id);
        // Soft-delete lógico — respetar historial de ventas
        $cliente->update(['activo' => false]);
        return response()->json(['message' => 'Cliente desactivado']);
    }

    /**
     * Validación reutilizable para store/update.
     * Cuando $cliente viene (update), el UNIQUE por identificación excluye la fila actual.
     */
    protected function validated(Request $request, ?Cliente $cliente = null): array
    {
        $empresaId = $request->attributes->get('empresa')->id;
        $identificacionRule = ['required','string','max:30'];
        $identificacionRule[] = Rule::unique('landlord.clientes', 'identificacion')
            ->where(fn($q) => $q->where('empresa_id', $empresaId))
            ->ignore($cliente?->id);

        return $request->validate([
            'codigo'            => 'nullable|string|max:20',
            'razon_social'      => 'required|string|max:200',
            'tipo_persona'      => 'required|in:natural,juridica',
            'tipo_documento_id' => 'nullable|integer',
            'identificacion'    => $identificacionRule,
            'dv'                => 'nullable|string|max:2',
            'nombre_comercial'  => 'nullable|string|max:200',
            'email'             => 'nullable|email|max:150',
            'telefono'          => 'nullable|string|max:50',
            'whatsapp'          => 'nullable|string|max:50',
            'direccion'         => 'nullable|string|max:200',
            'municipio_id'      => 'nullable|integer',
            'regimen_id'        => 'nullable|integer',
            'liability_id'      => 'nullable|integer',
            'cupo_credito'      => 'nullable|numeric|min:0',
            'dias_credito'      => 'nullable|integer|min:0',
            'fecha_cumpleanos'  => 'nullable|date',
            'observaciones'     => 'nullable|string',
            'retenciones'       => 'nullable|array',
            'activo'            => 'sometimes|boolean',
        ]);
    }
}
