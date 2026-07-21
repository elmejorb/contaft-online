<?php

namespace App\Services;

use App\Models\Tenant\Kardex;
use App\Models\Tenant\Producto;

/**
 * Registra movimientos de inventario en el kardex INMUTABLE y mantiene el
 * saldo de existencia del producto. Debe invocarse SIEMPRE dentro de una
 * transacción (el caller la abre). Reutilizable por ventas, compras y ajustes.
 *
 * El kardex nunca se edita/borra: una salida se corrige con un 'reverso' que
 * re-suma la cantidad (ver anularSalidaVenta).
 */
class KardexService
{
    /**
     * Registra la SALIDA de inventario por una venta. Descuenta existencia del
     * producto y agrega la fila de kardex. Servicios (es_servicio) no mueven
     * inventario y se ignoran.
     *
     * @param array $lineas Líneas calculadas (con producto_id, cantidad, precio_costo, es_servicio).
     */
    public function salidaPorVenta(int $ventaId, array $lineas, ?int $usuarioId, string $fecha): void
    {
        foreach ($lineas as $l) {
            if (!empty($l['es_servicio'])) {
                continue;
            }
            $cantidad = (float) ($l['cantidad'] ?? 0);
            if ($cantidad <= 0) {
                continue;
            }

            $producto = Producto::lockForUpdate()->find($l['producto_id']);
            if (!$producto || $producto->es_servicio) {
                continue;
            }

            $costo         = (float) ($l['precio_costo'] ?? $producto->precio_costo);
            $nuevoSaldo    = (float) $producto->existencia - $cantidad;
            $costoMovto    = round($costo * $cantidad, 2);

            $producto->existencia = $nuevoSaldo;
            $producto->save();

            Kardex::create([
                'fecha'            => $fecha,
                'producto_id'      => $producto->id,
                'tipo'             => 'salida',
                'concepto'         => "Venta #{$ventaId}",
                'referencia_tipo'  => 'venta',
                'referencia_id'    => $ventaId,
                'cantidad_entrada' => 0,
                'cantidad_salida'  => $cantidad,
                'costo_unitario'   => $costo,
                'costo_movimiento' => $costoMovto,
                'saldo_cantidad'   => $nuevoSaldo,
                'saldo_costo'      => round($nuevoSaldo * $costo, 2),
                'usuario_id'       => $usuarioId,
            ]);
        }
    }

    /**
     * Reversa las salidas de una venta anulada: re-suma la existencia y agrega
     * filas de kardex tipo 'reverso' (NO borra las salidas originales).
     */
    public function anularSalidaVenta(int $ventaId, ?int $usuarioId, string $fecha): void
    {
        $salidas = Kardex::where('referencia_tipo', 'venta')
            ->where('referencia_id', $ventaId)
            ->where('tipo', 'salida')
            ->get();

        foreach ($salidas as $s) {
            $cantidad = (float) $s->cantidad_salida;
            if ($cantidad <= 0) {
                continue;
            }

            $producto = Producto::lockForUpdate()->find($s->producto_id);
            if (!$producto) {
                continue;
            }

            $costo      = (float) $s->costo_unitario;
            $nuevoSaldo = (float) $producto->existencia + $cantidad;

            $producto->existencia = $nuevoSaldo;
            $producto->save();

            Kardex::create([
                'fecha'            => $fecha,
                'producto_id'      => $producto->id,
                'tipo'             => 'reverso',
                'concepto'         => "Anulación venta #{$ventaId}",
                'referencia_tipo'  => 'venta',
                'referencia_id'    => $ventaId,
                'cantidad_entrada' => $cantidad,
                'cantidad_salida'  => 0,
                'costo_unitario'   => $costo,
                'costo_movimiento' => round($costo * $cantidad, 2),
                'saldo_cantidad'   => $nuevoSaldo,
                'saldo_costo'      => round($nuevoSaldo * $costo, 2),
                'usuario_id'       => $usuarioId,
            ]);
        }
    }
}
