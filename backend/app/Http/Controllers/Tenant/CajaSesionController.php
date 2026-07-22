<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Caja;
use App\Models\Tenant\CajaSesion;
use App\Models\Tenant\Venta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sesiones de caja: abrir / estado (con cuadre en vivo) / cerrar.
 *
 * Los totales se calculan al vuelo agregando ventas/pagos/movimientos con
 * caja_sesion_id = la sesión (por FK, no por ventana de fecha como el desktop).
 *
 * Efectivo esperado = base + ventas_contado_efectivo + pagos_efectivo
 *                     - egresos - anulaciones - retiros_parciales
 * Diferencia = conteo - efectivo esperado
 */
class CajaSesionController extends Controller
{
    /**
     * GET /api/caja-sesion/actual — sesión abierta del usuario actual (o null),
     * con el cuadre en vivo.
     */
    public function actual(Request $request): JsonResponse
    {
        $sesion = $this->sesionAbiertaDe($request->user()->id);
        return response()->json(['sesion' => $sesion ? $this->conCuadre($sesion) : null]);
    }

    /**
     * POST /api/caja-sesion/abrir  { caja_id, base_inicial }
     */
    public function abrir(Request $request): JsonResponse
    {
        $data = $request->validate([
            'caja_id'      => 'required|integer|exists:landlord.cajas,id',
            'base_inicial' => 'required|numeric|min:0',
        ]);

        $caja = Caja::findOrFail($data['caja_id']);
        if ($caja->esPrincipal()) {
            return response()->json(['message' => 'La caja principal no maneja sesiones.'], 422);
        }
        if (!$caja->activa) {
            return response()->json(['message' => 'La caja está inactiva.'], 422);
        }
        if (CajaSesion::where('caja_id', $caja->id)->where('estado', 'abierta')->exists()) {
            return response()->json(['message' => "La caja «{$caja->nombre}» ya tiene una sesión abierta."], 422);
        }

        $sesion = CajaSesion::create([
            'caja_id'        => $caja->id,
            'usuario_id'     => $request->user()->id,
            'fecha_apertura' => now(),
            'base_inicial'   => $data['base_inicial'],
            'estado'         => 'abierta',
        ]);

        return response()->json(['sesion' => $this->conCuadre($sesion)], 201);
    }

    /**
     * POST /api/caja-sesion/{id}/cerrar  { conteo, observacion? }
     * Persiste los acumulados + diferencia y marca la sesión cerrada.
     */
    public function cerrar(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'conteo'      => 'required|numeric|min:0',
            'observacion' => 'nullable|string|max:255',
        ]);

        $sesion = CajaSesion::findOrFail($id);
        if ($sesion->estado === 'cerrada') {
            return response()->json(['message' => 'La sesión ya está cerrada.'], 422);
        }

        $t = $this->totales($sesion);
        $sesion->update([
            'fecha_cierre'            => now(),
            'ventas_contado_efectivo' => $t['ventas_contado_efectivo'],
            'ventas_contado_transf'   => $t['ventas_contado_transf'],
            'ventas_credito'          => $t['ventas_credito'],
            'pagos_efectivo'          => $t['pagos_efectivo'],
            'pagos_transf'            => $t['pagos_transf'],
            'egresos'                 => $t['egresos'],
            'anulaciones'             => $t['anulaciones'],
            'retiros_parciales'       => $t['retiros_parciales'],
            'total_efectivo_sistema'  => $t['total_efectivo_sistema'],
            'conteo_final'            => $data['conteo'],
            'diferencia_final'        => round($data['conteo'] - $t['total_efectivo_sistema'], 2),
            'observacion'             => $data['observacion'] ?? null,
            'estado'                  => 'cerrada',
        ]);

        return response()->json(['sesion' => $sesion->fresh()->load('caja')]);
    }

    // ============================================================
    // Helpers
    // ============================================================

    public static function sesionAbiertaDe(int $usuarioId): ?CajaSesion
    {
        return CajaSesion::where('estado', 'abierta')
            ->where('usuario_id', $usuarioId)
            ->latest('fecha_apertura')
            ->first();
    }

    protected function conCuadre(CajaSesion $sesion): array
    {
        return array_merge(
            $sesion->load('caja')->toArray(),
            ['cuadre' => $this->totales($sesion)],
        );
    }

    /** Totales en vivo de la sesión (agregando por caja_sesion_id). */
    protected function totales(CajaSesion $s): array
    {
        $conn = DB::connection('landlord');

        $ventasContadoEf = (float) Venta::where('caja_sesion_id', $s->id)
            ->where('tipo_termino', 'contado')->where('estado', 'valida')
            ->sum(DB::raw('efectivo - cambio'));
        $ventasContadoTr = (float) Venta::where('caja_sesion_id', $s->id)
            ->where('tipo_termino', 'contado')->where('estado', 'valida')->sum('transferencia');
        $ventasCredito = (float) Venta::where('caja_sesion_id', $s->id)
            ->where('tipo_termino', 'credito')->where('estado', 'valida')->sum('total');
        $anulaciones = (float) Venta::where('caja_sesion_id', $s->id)
            ->where('tipo_termino', 'contado')->where('estado', 'anulada')
            ->sum(DB::raw('efectivo - cambio'));

        $pagosEf = (float) $conn->table('pagos')
            ->join('medios_pago', 'medios_pago.id', '=', 'pagos.medio_pago_id')
            ->where('pagos.caja_sesion_id', $s->id)->where('pagos.estado', 'valida')
            ->where('medios_pago.tipo', 'efectivo')->sum('pagos.valor');
        $pagosTr = (float) $conn->table('pagos')
            ->join('medios_pago', 'medios_pago.id', '=', 'pagos.medio_pago_id')
            ->where('pagos.caja_sesion_id', $s->id)->where('pagos.estado', 'valida')
            ->where('medios_pago.tipo', '!=', 'efectivo')->sum('pagos.valor');

        $egresos = (float) $conn->table('caja_movimientos')
            ->where('caja_sesion_id', $s->id)->where('tipo', 'gasto')->sum('valor');
        $retiros = (float) $conn->table('caja_movimientos')
            ->where('caja_sesion_id', $s->id)->where('tipo', 'retiro_parcial')->sum('valor');

        $totalEfectivo = (float) $s->base_inicial + $ventasContadoEf + $pagosEf - $egresos - $anulaciones - $retiros;

        return [
            'ventas_contado_efectivo' => round($ventasContadoEf, 2),
            'ventas_contado_transf'   => round($ventasContadoTr, 2),
            'ventas_credito'          => round($ventasCredito, 2),
            'pagos_efectivo'          => round($pagosEf, 2),
            'pagos_transf'            => round($pagosTr, 2),
            'egresos'                 => round($egresos, 2),
            'anulaciones'             => round($anulaciones, 2),
            'retiros_parciales'       => round($retiros, 2),
            'total_efectivo_sistema'  => round($totalEfectivo, 2),
        ];
    }
}
