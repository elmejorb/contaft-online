<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD de productos del catálogo.
 * IMPORTANTE: precio_costo, precio_venta_1/2/3 se guardan CON IVA
 * incluido cuando empresa_config.iva_incluido = 1 (default Colombia).
 * NO revertir esta convención — es la del desktop y evita bugs de cálculo.
 */
class ProductoController extends Controller
{
    /**
     * GET /api/productos?q=&familia_id=&es_servicio=&activo=&per_page=
     */
    public function index(Request $request): JsonResponse
    {
        $q = Producto::query();

        if ($busq = trim((string) $request->query('q', ''))) {
            $q->where(function ($w) use ($busq) {
                $w->where('codigo', 'LIKE', "%{$busq}%")
                  ->orWhere('codigo_barras', 'LIKE', "%{$busq}%")
                  ->orWhere('nombre', 'LIKE', "%{$busq}%");
            });
        }
        if ($request->filled('familia_id'))  $q->where('familia_id', $request->integer('familia_id'));
        if ($request->filled('es_servicio')) $q->where('es_servicio', $request->boolean('es_servicio'));
        if ($request->filled('activo'))      $q->where('activo', $request->boolean('activo'));

        $perPage = min((int) $request->query('per_page', 25), 100);
        return response()->json($q->orderBy('nombre')->paginate($perPage));
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['producto' => Producto::findOrFail($id)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $producto = Producto::create($data);
        return response()->json(['producto' => $producto], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $producto = Producto::findOrFail($id);
        $data = $this->validated($request, $producto);
        $producto->update($data);
        return response()->json(['producto' => $producto->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        // Soft-delete lógico. Nunca borrar físicamente — hay kardex asociado.
        $producto = Producto::findOrFail($id);
        $producto->update(['activo' => false]);
        return response()->json(['message' => 'Producto desactivado']);
    }

    protected function validated(Request $request, ?Producto $producto = null): array
    {
        $empresaId = $request->attributes->get('empresa')->id;
        $codigoRule = ['required','string','max:30'];
        $codigoRule[] = Rule::unique('landlord.productos', 'codigo')
            ->where(fn($q) => $q->where('empresa_id', $empresaId))
            ->ignore($producto?->id);

        return $request->validate([
            'codigo'             => $codigoRule,
            'codigo_barras'      => 'nullable|string|max:50',
            'nombre'             => 'required|string|max:200',
            'descripcion'        => 'nullable|string',
            'familia_id'         => 'nullable|integer',
            'unidad_medida_id'   => 'nullable|integer|exists:landlord.dian_unidades_medida,id',
            'es_servicio'        => 'sometimes|boolean',
            'tiene_componentes'  => 'sometimes|boolean',
            'tiene_lotes'        => 'sometimes|boolean',
            'precio_costo'       => 'sometimes|numeric|min:0',
            'precio_venta_1'     => 'sometimes|numeric|min:0',
            'precio_venta_2'     => 'sometimes|numeric|min:0',
            'precio_venta_3'     => 'sometimes|numeric|min:0',
            'precio_minimo'      => 'sometimes|numeric|min:0',
            'iva_pct'            => 'sometimes|numeric|min:0|max:100',
            'existencia'         => 'sometimes|numeric',
            'existencia_minima'  => 'sometimes|numeric|min:0',
            'ubicacion'          => 'nullable|string|max:50',
            'etiqueta'           => 'nullable|string|max:60',
            'proveedor_id'       => 'nullable|integer',
            'imagen_path'        => 'nullable|string|max:500',
            'notas'              => 'nullable|string',
            'activo'             => 'sometimes|boolean',
        ]);
    }
}
