<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Pago;
use App\Models\Tenant\Producto;
use App\Models\Tenant\Retencion;
use App\Models\Tenant\Venta;
use App\Models\Tenant\VentaLinea;
use App\Models\Tenant\VentaRetencion;
use App\Services\KardexService;
use App\Services\VentaCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ventas / documentos de venta. Toda la persistencia es TRANSACCIONAL y los
 * totales se calculan SIEMPRE en el servidor (VentaCalculator) — el front manda
 * las líneas crudas, aquí se recalcula.
 *
 * No hay update: una venta emitida no se edita, se anula y se re-crea.
 */
class VentaController extends Controller
{
    public function __construct(
        private VentaCalculator $calculator,
        private KardexService $kardex,
    ) {}

    /**
     * GET /api/ventas?q=&cliente_id=&tipo_documento=&tipo_termino=&estado=&desde=&hasta=&per_page=
     */
    /**
     * GET /api/ventas — listado para la pantalla de gestión (AG Grid).
     * Filtros: anio, mes (0=todos), dia (0=todos), estado (valida|anulada|todas),
     * tipo_documento, buscar (número/cliente/identificación).
     * Devuelve cada venta con conteo de ítems, saldo (cartera) y medio de pago,
     * más la lista de años disponibles para el selector.
     */
    public function index(Request $request): JsonResponse
    {
        $conn   = DB::connection('landlord');
        $anio   = (int) $request->query('anio', now()->year);
        $mes    = (int) $request->query('mes', 0);
        $dia    = (int) $request->query('dia', 0);
        $estado = (string) $request->query('estado', 'valida');
        $busq   = trim((string) ($request->query('buscar') ?? $request->query('q') ?? ''));

        $q = Venta::query()
            ->select('ventas.*')
            ->with('cliente:id,razon_social,identificacion')
            ->withCount('lineas')
            ->addSelect(['medio_pago_nombre' => $conn->table('medios_pago')
                ->select('nombre')->whereColumn('medios_pago.id', 'ventas.medio_pago_id')])
            ->addSelect(['saldo' => $conn->table('vw_facturas_saldo')
                ->select('saldo')->whereColumn('vw_facturas_saldo.venta_id', 'ventas.id')])
            ->whereYear('fecha', $anio);

        if ($mes > 0) $q->whereMonth('fecha', $mes);
        if ($dia > 0) $q->whereDay('fecha', $dia);
        if ($estado !== 'todas') $q->where('estado', $estado);
        if ($request->filled('tipo_documento')) $q->where('tipo_documento', $request->query('tipo_documento'));
        if ($busq !== '') {
            $q->where(function ($w) use ($busq) {
                $w->where('numero', 'LIKE', "%{$busq}%")
                  ->orWhereHas('cliente', fn($c) => $c->where('razon_social', 'LIKE', "%{$busq}%")
                                                       ->orWhere('identificacion', 'LIKE', "%{$busq}%"));
            });
        }

        $ventas = $q->orderByDesc('fecha')->orderByDesc('id')->limit(2000)->get();

        $anios = Venta::query()->selectRaw('DISTINCT YEAR(fecha) as y')->orderByDesc('y')->pluck('y');
        if ($anios->isEmpty()) $anios = collect([now()->year]);

        return response()->json(['ventas' => $ventas, 'anios' => $anios]);
    }

    public function show(int $id): JsonResponse
    {
        $venta = Venta::with(['lineas.producto:id,codigo,nombre', 'retenciones', 'pagos', 'cliente', 'vendedor'])->findOrFail($id);
        return response()->json(['venta' => $venta]);
    }

    /**
     * POST /api/ventas — crea la venta, calcula totales, afecta kardex y cartera.
     */
    public function store(Request $request): JsonResponse
    {
        $data    = $this->validated($request);
        $empresa = $request->attributes->get('empresa');
        $config  = $this->config($empresa->id);
        $usuarioId = $request->user()->id;

        $tipoDocumento = $data['tipo_documento'] ?? 'remision';
        $tipoTermino   = $data['tipo_termino'] ?? 'contado';
        $esCotizacion  = $tipoDocumento === 'cotizacion';
        $diasCredito   = $tipoTermino === 'credito' ? (int) ($data['dias_credito'] ?? 0) : 0;

        // Caja: validar la sesión (si viene) y aplicar la regla usa_caja.
        $cajaSesionId = $data['caja_sesion_id'] ?? null;
        if ($cajaSesionId && !\App\Models\Tenant\CajaSesion::where('id', $cajaSesionId)->where('estado', 'abierta')->exists()) {
            $cajaSesionId = null;
        }
        if ($config->usa_caja && $tipoTermino === 'contado' && !$esCotizacion && !$cajaSesionId) {
            abort(response()->json([
                'message' => 'Debes abrir una caja para registrar ventas de contado.',
                'errors'  => ['caja' => ['Sin caja abierta']],
            ], 422));
        }

        // Resolver líneas y retenciones contra el catálogo (fuente autoritativa).
        $lineasIn = $this->resolverLineas($data['lineas'], (int) ($data['lista_precio'] ?? 1));
        $retIn    = $this->resolverRetenciones($data['retenciones'] ?? []);

        // Calcular TODO en el servidor.
        $calc = $this->calculator->calcular([
            'lineas'             => $lineasIn,
            'descuento_global'   => (float) ($data['descuento_global'] ?? 0),
            'iva_incluido'       => (bool) $config->iva_incluido,
            'es_responsable_iva' => $this->esResponsableIva($empresa),
            'retenciones'        => $retIn,
        ]);

        // Validar stock (salvo cotización o si la empresa permite negativo).
        if (!$esCotizacion && !$config->permitir_facturar_negativo) {
            $this->validarStock($calc['lineas']);
        }

        $fecha = $data['fecha'] ?? now()->toDateTimeString();

        $venta = DB::connection('landlord')->transaction(function () use (
            $data, $calc, $tipoDocumento, $tipoTermino, $diasCredito, $esCotizacion,
            $fecha, $usuarioId, $cajaSesionId
        ) {
            $numero = $this->siguienteNumero($tipoDocumento);

            $venta = Venta::create([
                'numero'           => $numero,
                'tipo_documento'   => $tipoDocumento,
                'tipo_termino'     => $tipoTermino,
                'dias_credito'     => $diasCredito,
                'fecha'            => $fecha,
                'cliente_id'       => $data['cliente_id'],
                'vendedor_id'      => $data['vendedor_id'] ?? null,
                'lista_precio'     => $data['lista_precio'] ?? 1,
                'descuento_global' => $calc['descuento_global'],
                'subtotal'         => $calc['subtotal'],
                'total_iva'        => $calc['total_iva'],
                'total'            => $calc['total'],
                'comentario'       => $data['comentario'] ?? null,
                'medio_pago_id'    => $data['medio_pago_id'] ?? null,
                'efectivo'         => $data['efectivo'] ?? 0,
                'transferencia'    => $data['transferencia'] ?? 0,
                'cambio'           => $this->cambio($tipoTermino, (float) ($data['efectivo'] ?? 0), $calc['total']),
                'abono_inicial'    => $tipoTermino === 'credito' ? ($data['abono_inicial'] ?? 0) : 0,
                // Campos DIAN base (la emisión FE real es Subfase 4).
                'payment_form_id'  => $tipoTermino === 'credito' ? 2 : 1,
                'payment_due_days' => $tipoTermino === 'credito' ? $diasCredito : null,
                'estado'           => 'valida',
                'usuario_id'       => $usuarioId,
                'caja_sesion_id'   => $cajaSesionId,
            ]);

            foreach ($calc['lineas'] as $l) {
                VentaLinea::create([
                    'venta_id'         => $venta->id,
                    'linea_num'        => $l['linea_num'],
                    'producto_id'      => $l['producto_id'],
                    'descripcion_temp' => $l['descripcion_temp'],
                    'cantidad'         => $l['cantidad'],
                    'precio_costo'     => $l['precio_costo'],
                    'precio_venta'     => $l['precio_venta'],
                    'iva_pct'          => $l['iva_pct'],
                    'iva_monto'        => $l['iva_monto'],
                    'descuento_monto'  => $l['descuento_monto'],
                    'subtotal'         => $l['subtotal'],
                    'total_linea'      => $l['total_linea'],
                ]);
            }

            foreach ($calc['retenciones'] as $r) {
                VentaRetencion::create([
                    'venta_id'     => $venta->id,
                    'retencion_id' => $r['retencion_id'],
                    'porcentaje'   => $r['porcentaje'],
                    'base'         => $r['base'],
                    'valor'        => $r['valor'],
                    'modo'         => $r['modo'],
                ]);
            }

            // Abono inicial de una venta a crédito → fila en pagos (cartera).
            if ($tipoTermino === 'credito' && (float) ($data['abono_inicial'] ?? 0) > 0) {
                Pago::create([
                    'consecutivo'    => $this->siguienteConsecutivoPago(),
                    'fecha'          => $fecha,
                    'cliente_id'     => $data['cliente_id'],
                    'venta_id'       => $venta->id,
                    'medio_pago_id'  => $data['medio_pago_id'] ?? 1,
                    'valor'          => $data['abono_inicial'],
                    'detalle'        => 'Abono inicial',
                    'usuario_id'     => $usuarioId,
                    'caja_sesion_id' => $cajaSesionId,
                    'estado'         => 'valida',
                ]);
            }

            // Kardex: cotización NO mueve inventario.
            if (!$esCotizacion) {
                $this->kardex->salidaPorVenta($venta->id, $calc['lineas'], $usuarioId, $fecha);
            }

            return $venta;
        });

        return response()->json([
            'venta' => $venta->load(['lineas', 'retenciones', 'pagos']),
        ], 201);
    }

    /**
     * POST /api/ventas/{id}/anular — marca anulada, reversa kardex y pagos.
     */
    public function anular(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|max:500',
        ]);

        $venta = Venta::findOrFail($id);
        if ($venta->estado === 'anulada') {
            return response()->json(['message' => 'La venta ya está anulada.'], 422);
        }

        $usuarioId = $request->user()->id;
        $fecha = now()->toDateTimeString();

        DB::connection('landlord')->transaction(function () use ($venta, $data, $usuarioId, $fecha) {
            $venta->update([
                'estado'         => 'anulada',
                'anulada_at'     => $fecha,
                'anulada_por'    => $usuarioId,
                'anulada_motivo' => $data['motivo'],
            ]);

            // Anular pagos asociados (salen de cartera).
            $venta->pagos()->where('estado', 'valida')->update([
                'estado'         => 'anulada',
                'anulado_at'     => $fecha,
                'anulado_por'    => $usuarioId,
                'anulado_motivo' => 'Venta anulada',
            ]);

            // Reversar kardex (cotización nunca movió inventario).
            if ($venta->afectaInventario()) {
                $this->kardex->anularSalidaVenta($venta->id, $usuarioId, $fecha);
            }
        });

        return response()->json(['venta' => $venta->fresh(['lineas', 'pagos'])]);
    }

    // ============================================================
    // Helpers
    // ============================================================

    protected function validated(Request $request): array
    {
        return $request->validate([
            'tipo_documento'          => 'sometimes|in:remision,electronica,soporte,cotizacion',
            'tipo_termino'            => 'sometimes|in:contado,credito',
            'dias_credito'            => 'nullable|integer|min:0',
            'fecha'                   => 'nullable|date',
            'cliente_id'              => 'required|integer|exists:landlord.clientes,id',
            'vendedor_id'             => 'nullable|integer|exists:landlord.vendedores,id',
            'lista_precio'            => 'sometimes|integer|in:1,2,3',
            'descuento_global'        => 'nullable|numeric|min:0',
            'comentario'              => 'nullable|string',
            'medio_pago_id'           => 'nullable|integer|exists:landlord.medios_pago,id',
            'efectivo'                => 'nullable|numeric|min:0',
            'transferencia'           => 'nullable|numeric|min:0',
            'abono_inicial'           => 'nullable|numeric|min:0',
            'caja_sesion_id'          => 'nullable|integer|exists:landlord.caja_sesiones,id',

            'lineas'                  => 'required|array|min:1',
            'lineas.*.producto_id'    => 'required|integer|exists:landlord.productos,id',
            'lineas.*.cantidad'       => 'required|numeric|gt:0',
            'lineas.*.precio_venta'   => 'nullable|numeric|min:0',
            'lineas.*.descuento'      => 'nullable|numeric|min:0',
            'lineas.*.iva_pct'        => 'nullable|numeric|min:0|max:100',
            'lineas.*.descripcion_temp' => 'nullable|string|max:300',

            'retenciones'               => 'nullable|array',
            'retenciones.*.retencion_id' => 'required|integer|exists:landlord.retenciones,id',
            'retenciones.*.modo'         => 'nullable|in:inf,gross_up',
        ]);
    }

    protected function config(int $empresaId): \App\Models\Tenant\EmpresaConfig
    {
        return \App\Models\Tenant\EmpresaConfig::where('empresa_id', $empresaId)->firstOrFail();
    }

    /**
     * ¿La empresa es responsable de IVA? Responsable salvo que su régimen sea
     * explícitamente "No responsable de IVA" (dian_tipos_regimen.codigo = '49').
     */
    protected function esResponsableIva($empresa): bool
    {
        if (empty($empresa->tipo_regimen_id)) {
            return true; // default comercial: cobra IVA
        }
        $codigo = DB::connection('landlord')
            ->table('dian_tipos_regimen')
            ->where('id', $empresa->tipo_regimen_id)
            ->value('codigo');
        return $codigo !== '49';
    }

    /**
     * Enriquece las líneas del request con datos del catálogo (precio_costo,
     * iva_pct, es_servicio). El precio puede venir del front (POS permite
     * editarlo); si no viene, se toma el de la lista de precio del producto.
     */
    protected function resolverLineas(array $lineas, int $listaPrecio): array
    {
        $ids = collect($lineas)->pluck('producto_id')->unique()->all();
        $productos = Producto::whereIn('id', $ids)->get()->keyBy('id');

        $out = [];
        foreach ($lineas as $l) {
            $p = $productos->get($l['producto_id']);
            $precioLista = $p ? $this->precioPorLista($p, $listaPrecio) : 0;

            $out[] = [
                'producto_id'      => (int) $l['producto_id'],
                'cantidad'         => (float) $l['cantidad'],
                'precio_venta'     => isset($l['precio_venta']) ? (float) $l['precio_venta'] : (float) $precioLista,
                'descuento'        => (float) ($l['descuento'] ?? 0),
                'iva_pct'          => isset($l['iva_pct']) ? (float) $l['iva_pct'] : (float) ($p->iva_pct ?? 0),
                'precio_costo'     => (float) ($p->precio_costo ?? 0),
                'es_servicio'      => (bool) ($p->es_servicio ?? false),
                'descripcion_temp' => $l['descripcion_temp'] ?? null,
            ];
        }
        return $out;
    }

    protected function precioPorLista(Producto $p, int $lista): float
    {
        return match ($lista) {
            2 => (float) $p->precio_venta_2 ?: (float) $p->precio_venta_1,
            3 => (float) $p->precio_venta_3 ?: (float) $p->precio_venta_1,
            default => (float) $p->precio_venta_1,
        };
    }

    /**
     * Resuelve el porcentaje y modo de cada retención desde el catálogo de la
     * empresa. El modo se toma de retenciones.tipo_calculo (gross_up|sobre_base)
     * salvo override explícito del request.
     */
    protected function resolverRetenciones(array $retenciones): array
    {
        if (empty($retenciones)) return [];

        $ids = collect($retenciones)->pluck('retencion_id')->unique()->all();
        $cat = Retencion::whereIn('id', $ids)->get()->keyBy('id');

        $out = [];
        foreach ($retenciones as $r) {
            $reten = $cat->get($r['retencion_id']);
            if (!$reten) continue;
            $modo = $r['modo'] ?? ($reten->tipo_calculo === 'gross_up' ? 'gross_up' : 'inf');
            $out[] = [
                'retencion_id' => (int) $r['retencion_id'],
                'porcentaje'   => (float) $reten->porcentaje,
                'modo'         => $modo,
            ];
        }
        return $out;
    }

    /** Valida existencia suficiente por producto (agrega cantidades por producto). */
    protected function validarStock(array $lineas): void
    {
        $porProducto = [];
        foreach ($lineas as $l) {
            if (!empty($l['es_servicio'])) continue;
            $porProducto[$l['producto_id']] = ($porProducto[$l['producto_id']] ?? 0) + (float) $l['cantidad'];
        }
        if (empty($porProducto)) return;

        $productos = Producto::whereIn('id', array_keys($porProducto))->get()->keyBy('id');
        foreach ($porProducto as $pid => $cant) {
            $p = $productos->get($pid);
            if ($p && !$p->es_servicio && (float) $p->existencia < $cant) {
                abort(response()->json([
                    'message' => "Stock insuficiente para «{$p->nombre}» (disponible: {$p->existencia}, requerido: {$cant}).",
                    'errors'  => ['stock' => ["Producto {$p->codigo} sin existencia suficiente"]],
                ], 422));
            }
        }
    }

    /** Consecutivo por (empresa_id, tipo_documento) con lock para evitar carreras. */
    protected function siguienteNumero(string $tipoDocumento): int
    {
        $max = Venta::where('tipo_documento', $tipoDocumento)
            ->lockForUpdate()
            ->max('numero');

        if ($max !== null) {
            return (int) $max + 1;
        }
        // Primera venta de este tipo: Remisión arranca en iniciar_factura_en; el resto en 1.
        if ($tipoDocumento === 'remision') {
            $empresaId = \App\Models\Concerns\BelongsToEmpresa::empresaIdActual();
            $inicio = \App\Models\Tenant\EmpresaConfig::where('empresa_id', $empresaId)->value('iniciar_factura_en');
            return (int) ($inicio ?: 1);
        }
        return 1;
    }

    protected function siguienteConsecutivoPago(): int
    {
        $max = Pago::lockForUpdate()->max('consecutivo');
        return $max !== null ? (int) $max + 1 : 1;
    }

    protected function cambio(string $tipoTermino, float $efectivo, float $total): float
    {
        if ($tipoTermino === 'contado' && $efectivo > 0) {
            return round(max($efectivo - $total, 0), 2);
        }
        return 0;
    }
}
