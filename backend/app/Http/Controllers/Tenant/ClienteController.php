<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Cliente;
use App\Models\Tenant\ClienteContactoNotificacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * CRUD de clientes con soporte completo DIAN + contactos de notificación
 * (emails Cc). El aislamiento por empresa_id es automático vía
 * BelongsToEmpresa + EmpresaScope global.
 */
class ClienteController extends Controller
{
    /**
     * GET /api/clientes?q=&activo=1&per_page=25
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

    /**
     * GET /api/clientes/:id — con contactos incluidos
     */
    public function show(int $id): JsonResponse
    {
        $cliente = Cliente::with('contactosNotificacion')->findOrFail($id);
        return response()->json(['cliente' => $cliente]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $contactos = $data['contactos'] ?? [];
        unset($data['contactos']);

        // Auto-calcular DV si no vino y aplica
        if (empty($data['dv']) && !empty($data['identificacion'])) {
            $data['dv'] = Cliente::calcularDv($data['identificacion']);
        }

        // Cachear departamento_id desde el municipio
        $data['departamento_id'] = $this->departamentoDelMunicipio($data['municipio_id'] ?? null);

        $cliente = DB::connection('landlord')->transaction(function () use ($data, $contactos) {
            $cliente = Cliente::create($data);
            $this->guardarContactos($cliente, $contactos);
            return $cliente->load('contactosNotificacion');
        });

        return response()->json(['cliente' => $cliente], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $cliente = Cliente::findOrFail($id);
        $data = $this->validated($request, $cliente);
        $contactos = $data['contactos'] ?? null;
        unset($data['contactos']);

        // Auto-DV al actualizar solo si NIT cambió y no viene DV
        if (empty($data['dv']) && !empty($data['identificacion']) && $data['identificacion'] !== $cliente->identificacion) {
            $data['dv'] = Cliente::calcularDv($data['identificacion']);
        }
        if (array_key_exists('municipio_id', $data)) {
            $data['departamento_id'] = $this->departamentoDelMunicipio($data['municipio_id']);
        }

        DB::connection('landlord')->transaction(function () use ($cliente, $data, $contactos) {
            $cliente->update($data);
            if (is_array($contactos)) {
                // Estrategia simple: borrar todos y reinsertar. El volumen por
                // cliente es pequeño (típico 1-5 contactos), no vale la pena
                // el diff granular.
                $cliente->contactosNotificacion()->delete();
                $this->guardarContactos($cliente, $contactos);
            }
        });

        return response()->json(['cliente' => $cliente->fresh('contactosNotificacion')]);
    }

    public function destroy(int $id): JsonResponse
    {
        $cliente = Cliente::findOrFail($id);
        $cliente->update(['activo' => false]);   // soft-delete lógico
        return response()->json(['message' => 'Cliente desactivado']);
    }

    /**
     * Validación reutilizable. En update, excluye el propio id del UNIQUE.
     */
    protected function validated(Request $request, ?Cliente $cliente = null): array
    {
        $empresaId = $request->attributes->get('empresa')->id;
        $identRule = ['required','string','max:30'];
        $identRule[] = Rule::unique('landlord.clientes', 'identificacion')
            ->where(fn($q) => $q->where('empresa_id', $empresaId))
            ->ignore($cliente?->id);

        return $request->validate([
            'codigo'              => 'nullable|string|max:20',
            'razon_social'        => 'required|string|max:200',
            'tipo_persona'        => 'required|in:natural,juridica',
            'tipo_documento_id'   => 'nullable|integer|exists:landlord.dian_tipos_documento,id',
            'identificacion'      => $identRule,
            'dv'                  => 'nullable|string|max:2',
            'matricula_mercantil' => 'nullable|string|max:30',
            'nombre_comercial'    => 'nullable|string|max:200',
            'email'               => 'nullable|email|max:150',
            'telefono'            => 'nullable|string|max:50',
            'whatsapp'            => 'nullable|string|max:50',
            'direccion'           => 'nullable|string|max:200',
            'municipio_id'        => 'nullable|integer|exists:landlord.dian_municipios,id',
            'departamento_id'     => 'nullable|integer',
            'regimen_id'          => 'nullable|integer|exists:landlord.dian_tipos_regimen,id',
            'liability_id'        => 'nullable|integer|exists:landlord.dian_tipos_responsabilidad,id',
            'tipo_adquirente_id'  => 'nullable|integer|exists:landlord.dian_tipos_adquirente,id',
            'cupo_credito'        => 'nullable|numeric|min:0',
            'dias_credito'        => 'nullable|integer|min:0',
            'fecha_cumpleanos'    => 'nullable|date',
            'observaciones'       => 'nullable|string',
            'retenciones'         => 'nullable|array',
            'activo'              => 'sometimes|boolean',

            // Contactos de notificación (array de objetos)
            'contactos'                    => 'nullable|array',
            'contactos.*.tipo'             => 'required_with:contactos.*.correo|in:entrega,contable,pagos,gerencia,otros',
            'contactos.*.nombre'           => 'nullable|string|max:150',
            'contactos.*.cargo'            => 'nullable|string|max:100',
            'contactos.*.correo'           => 'required_with:contactos.*.tipo|email|max:150',
            'contactos.*.telefono'         => 'nullable|string|max:50',
            'contactos.*.nota'             => 'nullable|string|max:300',
        ]);
    }

    /**
     * Guarda el array de contactos vinculado al cliente.
     * Asume que la tabla ya fue limpiada (en el update).
     */
    protected function guardarContactos(Cliente $cliente, array $contactos): void
    {
        foreach ($contactos as $c) {
            if (empty($c['correo'])) continue;
            ClienteContactoNotificacion::create([
                'cliente_id' => $cliente->id,
                'tipo'       => $c['tipo']     ?? 'entrega',
                'nombre'     => $c['nombre']   ?? null,
                'cargo'      => $c['cargo']    ?? null,
                'correo'     => $c['correo'],
                'telefono'   => $c['telefono'] ?? null,
                'nota'       => $c['nota']     ?? null,
                'activo'     => true,
            ]);
        }
    }

    /**
     * Busca el departamento_id al que pertenece un municipio para cachearlo.
     */
    protected function departamentoDelMunicipio(?int $municipioId): ?int
    {
        if (!$municipioId) return null;
        return DB::connection('landlord')
            ->table('dian_municipios')
            ->where('id', $municipioId)
            ->value('departamento_id');
    }
}
