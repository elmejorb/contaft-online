<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Proveedor;
use App\Models\Tenant\ProveedorContactoNotificacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * CRUD de proveedores. Mismo patrón que ClienteController — DV automático,
 * cascada dept↔muni, contactos anidados en la misma llamada.
 *
 * Filtro clave: ?tipo_soporte=fe_recibida | documento_soporte para separar
 * proveedores DIAN normales de los que se pagan con DS.
 */
class ProveedorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Proveedor::query();

        if ($busq = trim((string) $request->query('q', ''))) {
            $q->where(function ($w) use ($busq) {
                $w->where('razon_social', 'LIKE', "%{$busq}%")
                  ->orWhere('identificacion', 'LIKE', "%{$busq}%")
                  ->orWhere('email', 'LIKE', "%{$busq}%")
                  ->orWhere('telefono', 'LIKE', "%{$busq}%");
            });
        }
        if ($request->filled('tipo_soporte')) {
            $q->where('tipo_soporte', $request->query('tipo_soporte'));
        }
        if ($request->filled('activo')) {
            $q->where('activo', $request->boolean('activo'));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        return response()->json($q->orderBy('razon_social')->paginate($perPage));
    }

    public function show(int $id): JsonResponse
    {
        $prov = Proveedor::with('contactosNotificacion')->findOrFail($id);
        return response()->json(['proveedor' => $prov]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $contactos = $data['contactos'] ?? [];
        unset($data['contactos']);

        if (empty($data['dv']) && !empty($data['identificacion'])) {
            $data['dv'] = Proveedor::calcularDv($data['identificacion']);
        }
        $data['departamento_id'] = $this->departamentoDelMunicipio($data['municipio_id'] ?? null);

        $prov = DB::connection('landlord')->transaction(function () use ($data, $contactos) {
            $p = Proveedor::create($data);
            $this->guardarContactos($p, $contactos);
            return $p->load('contactosNotificacion');
        });

        return response()->json(['proveedor' => $prov], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $prov = Proveedor::findOrFail($id);
        $data = $this->validated($request, $prov);
        $contactos = $data['contactos'] ?? null;
        unset($data['contactos']);

        if (empty($data['dv']) && !empty($data['identificacion']) && $data['identificacion'] !== $prov->identificacion) {
            $data['dv'] = Proveedor::calcularDv($data['identificacion']);
        }
        if (array_key_exists('municipio_id', $data)) {
            $data['departamento_id'] = $this->departamentoDelMunicipio($data['municipio_id']);
        }

        DB::connection('landlord')->transaction(function () use ($prov, $data, $contactos) {
            $prov->update($data);
            if (is_array($contactos)) {
                $prov->contactosNotificacion()->delete();
                $this->guardarContactos($prov, $contactos);
            }
        });

        return response()->json(['proveedor' => $prov->fresh('contactosNotificacion')]);
    }

    public function destroy(int $id): JsonResponse
    {
        $prov = Proveedor::findOrFail($id);
        $prov->update(['activo' => false]);
        return response()->json(['message' => 'Proveedor desactivado']);
    }

    protected function validated(Request $request, ?Proveedor $prov = null): array
    {
        $empresaId = $request->attributes->get('empresa')->id;
        $identRule = ['required','string','max:30'];
        $identRule[] = Rule::unique('landlord.proveedores', 'identificacion')
            ->where(fn($q) => $q->where('empresa_id', $empresaId))
            ->ignore($prov?->id);

        return $request->validate([
            'codigo'                => 'nullable|string|max:20',
            'razon_social'          => 'required|string|max:200',
            'nombre_comercial'      => 'nullable|string|max:200',
            'tipo_persona'          => 'required|in:natural,juridica',
            'tipo_documento_id'     => 'nullable|integer|exists:landlord.dian_tipos_documento,id',
            'identificacion'        => $identRule,
            'dv'                    => 'nullable|string|max:2',
            'matricula_mercantil'   => 'nullable|string|max:30',

            'email'                 => 'nullable|email|max:150',
            'telefono'              => 'nullable|string|max:50',
            'whatsapp'              => 'nullable|string|max:50',
            'direccion'             => 'nullable|string|max:200',
            'departamento_id'       => 'nullable|integer',
            'municipio_id'          => 'nullable|integer|exists:landlord.dian_municipios,id',

            'regimen_id'            => 'nullable|integer|exists:landlord.dian_tipos_regimen,id',
            'liability_id'          => 'nullable|integer|exists:landlord.dian_tipos_responsabilidad,id',
            'no_obligado_facturar'  => 'sometimes|boolean',

            'tipo_soporte'          => 'required|in:fe_recibida,documento_soporte',

            'retencion_fuente_pct'  => 'nullable|numeric|min:0|max:100',
            'retencion_iva_pct'     => 'nullable|numeric|min:0|max:100',
            'retencion_ica_pct'     => 'nullable|numeric|min:0|max:100',
            'concepto_dian'         => 'nullable|string|max:150',

            'banco_nombre'          => 'nullable|string|max:100',
            'banco_tipo_cuenta'     => 'nullable|in:ahorros,corriente',
            'banco_numero_cuenta'   => 'nullable|string|max:50',

            'cupo_credito'          => 'nullable|numeric|min:0',
            'dias_credito'          => 'nullable|integer|min:0',
            'observaciones'         => 'nullable|string',
            'activo'                => 'sometimes|boolean',

            'contactos'                 => 'nullable|array',
            'contactos.*.tipo'          => 'required_with:contactos.*.correo|in:pagos,contable,gerencia,entregas,otros',
            'contactos.*.nombre'        => 'nullable|string|max:150',
            'contactos.*.cargo'         => 'nullable|string|max:100',
            'contactos.*.correo'        => 'required_with:contactos.*.tipo|email|max:150',
            'contactos.*.telefono'      => 'nullable|string|max:50',
            'contactos.*.nota'          => 'nullable|string|max:300',
        ]);
    }

    protected function guardarContactos(Proveedor $prov, array $contactos): void
    {
        foreach ($contactos as $c) {
            if (empty($c['correo'])) continue;
            ProveedorContactoNotificacion::create([
                'proveedor_id' => $prov->id,
                'tipo'         => $c['tipo']     ?? 'pagos',
                'nombre'       => $c['nombre']   ?? null,
                'cargo'        => $c['cargo']    ?? null,
                'correo'       => $c['correo'],
                'telefono'     => $c['telefono'] ?? null,
                'nota'         => $c['nota']     ?? null,
                'activo'       => true,
            ]);
        }
    }

    protected function departamentoDelMunicipio(?int $municipioId): ?int
    {
        if (!$municipioId) return null;
        return DB::connection('landlord')
            ->table('dian_municipios')
            ->where('id', $municipioId)
            ->value('departamento_id');
    }
}
