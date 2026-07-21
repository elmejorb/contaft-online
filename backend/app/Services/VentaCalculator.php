<?php

namespace App\Services;

/**
 * Cálculo de totales de una venta. Clase PURA (no toca BD) → testeable en
 * aislamiento. Es la ÚNICA fuente de verdad de los montos: el frontend manda
 * las líneas crudas (producto, cantidad, precio, descuento, iva_pct) y aquí se
 * recalcula todo.
 *
 * Reglas portadas 1:1 del desktop (NuevaVenta.tsx:589-632). Ver
 * docs/ARQUITECTURA.md §6.
 *
 *   IVA incluido:  iva = subtotal * (pct / (100 + pct))   ← EXTRAE de dentro
 *   IVA por encima: iva = subtotal * (pct / 100)          ← SUMA encima
 *   Régimen no responsable → IVA = 0 siempre.
 *   Gross-up de retención reescala subtotal/iva/líneas para que el neto tras
 *   retención iguale al total base.
 *
 * Invariante garantizada: subtotal y total_iva de cabecera == suma de los de
 * las líneas (se redondea por línea y luego se suma), para que cartera/informes
 * cuadren sin descuadres de centavos.
 */
class VentaCalculator
{
    /**
     * @param array $input {
     *   lineas: array<array{producto_id:int, cantidad:float, precio_venta:float,
     *           descuento?:float, iva_pct?:float, precio_costo?:float,
     *           es_servicio?:bool, descripcion_temp?:?string}>,
     *   descuento_global?: float,
     *   iva_incluido: bool,
     *   es_responsable_iva: bool,
     *   retenciones?: array<array{retencion_id:int, porcentaje:float, modo?:string}>
     * }
     * @return array Resultado con lineas calculadas, retenciones y totales.
     */
    public function calcular(array $input): array
    {
        $ivaIncluido      = (bool) ($input['iva_incluido'] ?? true);
        $esResponsableIva = (bool) ($input['es_responsable_iva'] ?? true);
        $descuentoGlobal  = round((float) ($input['descuento_global'] ?? 0), 2);
        $retencionesIn    = $input['retenciones'] ?? [];

        // --- Paso 1: base por línea (sin gross-up todavía) ---
        $lineasBase   = [];
        $subtotalBase = 0.0;
        $totalIvaBase = 0.0;

        foreach (array_values($input['lineas'] ?? []) as $i => $l) {
            $cantidad  = (float) ($l['cantidad'] ?? 0);
            $precio    = (float) ($l['precio_venta'] ?? 0);
            $descuento = (float) ($l['descuento'] ?? 0);
            $ivaPct    = $esResponsableIva ? (float) ($l['iva_pct'] ?? 0) : 0.0;

            $subtotal = ($cantidad * $precio) - $descuento;

            $ivaLinea = 0.0;
            if ($esResponsableIva && $ivaPct > 0) {
                $ivaLinea = $ivaIncluido
                    ? $subtotal * ($ivaPct / (100 + $ivaPct))
                    : $subtotal * ($ivaPct / 100);
            }

            $subtotalBase += $subtotal;
            $totalIvaBase += $ivaLinea;

            $lineasBase[] = [
                'linea_num'        => $i + 1,
                'producto_id'      => (int) ($l['producto_id'] ?? 0),
                'descripcion_temp' => $l['descripcion_temp'] ?? null,
                'es_servicio'      => (bool) ($l['es_servicio'] ?? false),
                'cantidad'         => $cantidad,
                'precio_costo'     => (float) ($l['precio_costo'] ?? 0),
                'precio_venta'     => $precio,
                'iva_pct'          => $ivaPct,
                'descuento'        => $descuento,
                'subtotal'         => $subtotal,
                'iva_monto'        => $ivaLinea,
            ];
        }

        // --- Paso 2: gross-up de retención ---
        $ivaFrac = $subtotalBase > 0 ? $totalIvaBase / $subtotalBase : 0.0;

        $pctTotalRetencion = 0.0;
        $hayGrossUp = false;
        foreach ($retencionesIn as $r) {
            $pctTotalRetencion += (float) ($r['porcentaje'] ?? 0);
            if (($r['modo'] ?? 'inf') === 'gross_up') {
                $hayGrossUp = true;
            }
        }
        $retFrac = $pctTotalRetencion / 100;

        $factor = 1.0;
        if ($hayGrossUp && $retFrac > 0 && (1 + $ivaFrac - $retFrac) > 0) {
            $factor = (1 + $ivaFrac) / (1 + $ivaFrac - $retFrac);
        }

        // --- Paso 3: reescalar líneas por el factor y redondear ---
        $lineas       = [];
        $subtotal     = 0.0;
        $totalIva     = 0.0;
        foreach ($lineasBase as $lb) {
            $precioVenta    = round($lb['precio_venta'] * $factor, 4);
            $descuentoMonto = round($lb['descuento']    * $factor, 2);
            $subtotalLinea  = round($lb['subtotal']     * $factor, 2);
            $ivaMonto       = round($lb['iva_monto']    * $factor, 2);

            // total_linea: con IVA incluido el subtotal ya lo trae; si no, se suma.
            $totalLinea = $ivaIncluido ? $subtotalLinea : round($subtotalLinea + $ivaMonto, 2);

            $subtotal += $subtotalLinea;
            $totalIva += $ivaMonto;

            $lineas[] = [
                'linea_num'        => $lb['linea_num'],
                'producto_id'      => $lb['producto_id'],
                'descripcion_temp' => $lb['descripcion_temp'],
                'es_servicio'      => $lb['es_servicio'],
                'cantidad'         => $lb['cantidad'],
                'precio_costo'     => $lb['precio_costo'],
                'precio_venta'     => $precioVenta,
                'iva_pct'          => $lb['iva_pct'],
                'iva_monto'        => $ivaMonto,
                'descuento_monto'  => $descuentoMonto,
                'subtotal'         => $subtotalLinea,
                'total_linea'      => $totalLinea,
            ];
        }
        $subtotal = round($subtotal, 2);
        $totalIva = round($totalIva, 2);

        // --- Paso 4: total de la factura ---
        $total = $ivaIncluido
            ? round($subtotal - $descuentoGlobal, 2)
            : round($subtotal + $totalIva - $descuentoGlobal, 2);

        // --- Paso 5: retenciones (base = subtotal grossed-up) ---
        $retenciones      = [];
        $totalRetenciones = 0.0;
        foreach ($retencionesIn as $r) {
            $pct   = (float) ($r['porcentaje'] ?? 0);
            $valor = round($subtotal * $pct / 100, 2);
            $totalRetenciones += $valor;
            $retenciones[] = [
                'retencion_id' => (int) ($r['retencion_id'] ?? 0),
                'porcentaje'   => $pct,
                'base'         => $subtotal,
                'valor'        => $valor,
                'modo'         => ($r['modo'] ?? 'inf') === 'gross_up' ? 'gross_up' : 'inf',
            ];
        }
        $totalRetenciones = round($totalRetenciones, 2);

        return [
            'lineas'            => $lineas,
            'retenciones'       => $retenciones,
            'subtotal'          => $subtotal,
            'total_iva'         => $totalIva,
            'descuento_global'  => $descuentoGlobal,
            'total'             => $total,
            'total_retenciones' => $totalRetenciones,
            'neto'              => round($total - $totalRetenciones, 2),
            'factor_gross_up'   => round($factor, 6),
        ];
    }
}
