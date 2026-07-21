<?php

namespace Tests\Unit;

use App\Services\VentaCalculator;
use PHPUnit\Framework\TestCase;

/**
 * Cubre las reglas fiscales colombianas más propensas a bug (docs/ARQUITECTURA.md §6).
 * Test puro: VentaCalculator no depende de Laravel ni de BD.
 */
class VentaCalculatorTest extends TestCase
{
    private VentaCalculator $calc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calc = new VentaCalculator();
    }

    /** IVA incluido en el precio: se EXTRAE con pct/(100+pct), no se suma encima. */
    public function test_iva_incluido_se_extrae_del_precio(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => true,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 1, 'precio_venta' => 11900, 'iva_pct' => 19],
            ],
        ]);

        $this->assertEqualsWithDelta(11900, $r['subtotal'], 0.01);
        $this->assertEqualsWithDelta(1900,  $r['total_iva'], 0.01);   // 11900 * 19/119
        $this->assertEqualsWithDelta(11900, $r['total'], 0.01);       // total NO suma IVA
    }

    /** IVA por encima: se SUMA al subtotal. */
    public function test_iva_no_incluido_se_suma_encima(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => false,
            'es_responsable_iva' => true,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 1, 'precio_venta' => 10000, 'iva_pct' => 19],
            ],
        ]);

        $this->assertEqualsWithDelta(10000, $r['subtotal'], 0.01);
        $this->assertEqualsWithDelta(1900,  $r['total_iva'], 0.01);
        $this->assertEqualsWithDelta(11900, $r['total'], 0.01);       // 10000 + 1900
    }

    /** Régimen no responsable → IVA 0 aunque el producto tenga pct. */
    public function test_regimen_no_responsable_fuerza_iva_cero(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => false,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 1, 'precio_venta' => 11900, 'iva_pct' => 19],
            ],
        ]);

        $this->assertEqualsWithDelta(0, $r['total_iva'], 0.01);
        $this->assertEqualsWithDelta(11900, $r['total'], 0.01);
    }

    /** Descuento por línea (valor absoluto) + descuento global. */
    public function test_descuentos_linea_y_global(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => false,
            'descuento_global'   => 500,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 2, 'precio_venta' => 5000, 'descuento' => 1000, 'iva_pct' => 0],
            ],
        ]);

        $this->assertEqualsWithDelta(9000, $r['subtotal'], 0.01);   // 2*5000 - 1000
        $this->assertEqualsWithDelta(8500, $r['total'], 0.01);      // 9000 - 500 global
    }

    /** Cabecera == suma de líneas (invariante para cartera/informes). */
    public function test_cabecera_es_suma_de_lineas(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => true,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 3, 'precio_venta' => 11900, 'iva_pct' => 19],
                ['producto_id' => 2, 'cantidad' => 1, 'precio_venta' => 5950,  'iva_pct' => 19],
            ],
        ]);

        $sumaSub = array_sum(array_column($r['lineas'], 'subtotal'));
        $sumaIva = array_sum(array_column($r['lineas'], 'iva_monto'));
        $this->assertEqualsWithDelta($sumaSub, $r['subtotal'], 0.001);
        $this->assertEqualsWithDelta($sumaIva, $r['total_iva'], 0.001);
    }

    /** Retención informativa: factor 1, no altera el subtotal. */
    public function test_retencion_informativa_no_altera_subtotal(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => true,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 1, 'precio_venta' => 119000, 'iva_pct' => 19],
            ],
            'retenciones' => [
                ['retencion_id' => 1, 'porcentaje' => 3.5, 'modo' => 'inf'],
            ],
        ]);

        $this->assertEqualsWithDelta(1.0, $r['factor_gross_up'], 0.0001);
        $this->assertEqualsWithDelta(119000, $r['subtotal'], 0.01);
        $this->assertEqualsWithDelta(4165, $r['total_retenciones'], 0.01);  // 119000 * 3.5%
        $this->assertEqualsWithDelta(114835, $r['neto'], 0.01);             // 119000 - 4165
    }

    /** Retención gross-up: reescala subtotal por (1+ivaFrac)/(1+ivaFrac-retFrac). */
    public function test_retencion_gross_up_reescala_subtotal(): void
    {
        $r = $this->calc->calcular([
            'iva_incluido'       => true,
            'es_responsable_iva' => true,
            'lineas' => [
                ['producto_id' => 1, 'cantidad' => 1, 'precio_venta' => 119000, 'iva_pct' => 19],
            ],
            'retenciones' => [
                ['retencion_id' => 1, 'porcentaje' => 3.5, 'modo' => 'gross_up'],
            ],
        ]);

        // ivaFrac = 19/119 = 0.159664 ; factor = 1.159664 / (1.159664 - 0.035) = 1.031120
        $this->assertEqualsWithDelta(1.031120, $r['factor_gross_up'], 0.0001);
        $this->assertEqualsWithDelta(122703.28, $r['subtotal'], 0.5);
        $this->assertGreaterThan(119000, $r['subtotal']);
    }
}
