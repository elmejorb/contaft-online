<?php

namespace Tests\Feature;

use App\Models\Landlord\Empresa;
use App\Models\Landlord\Usuario;
use App\Models\Tenant\Caja;
use App\Models\Tenant\Cliente;
use App\Models\Tenant\EmpresaConfig;
use App\Models\Tenant\Producto;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sesión de caja: apertura, que la venta de contado alimente el cuadre en vivo,
 * cierre con diferencia, y el bloqueo usa_caja.
 */
class CajaSesionTest extends TestCase
{
    use DatabaseTransactions;

    private Empresa $empresa;
    private Usuario $usuario;
    private Caja $caja;

    protected function setUp(): void
    {
        parent::setUp();
        $plan = DB::connection('landlord')->table('planes')->first();

        $this->empresa = Empresa::create([
            'razon_social' => 'CAJA TEST SAS', 'nit' => '900555111',
            'email_contacto' => 'c@t.com', 'bd_name' => 'contaft_online_test_caja',
            'plan_id' => $plan->id, 'trial_hasta' => now()->addDays(30), 'activa' => 1,
        ]);
        EmpresaConfig::create([
            'empresa_id' => $this->empresa->id, 'iva_incluido' => 1,
            'iniciar_factura_en' => 1, 'permitir_facturar_negativo' => 0, 'usa_caja' => 0,
        ]);
        $this->usuario = Usuario::create([
            'nombre' => 'Cajero', 'email' => 'caja@test.com', 'password_hash' => bcrypt('x'), 'activo' => 1,
        ]);
        $this->usuario->empresas()->attach($this->empresa->id, ['rol' => 'admin', 'empresa_default' => 1, 'activo' => 1]);
        $this->caja = Caja::create(['empresa_id' => $this->empresa->id, 'nombre' => 'Caja 1', 'tipo' => 'punto_venta', 'activa' => 1]);

        Sanctum::actingAs($this->usuario, ['*']);
    }

    private function h(): array
    {
        return ['X-Empresa-Id' => (string) $this->empresa->id, 'Accept' => 'application/json'];
    }

    public function test_venta_contado_alimenta_cuadre_y_cierre_calcula_diferencia(): void
    {
        // Abrir sesión con base 50.000
        $sesionId = $this->withHeaders($this->h())->postJson('/api/caja-sesion/abrir', [
            'caja_id' => $this->caja->id, 'base_inicial' => 50000,
        ])->assertCreated()->json('sesion.id');

        // Venta contado: total 10.000, efectivo 15.000 → cambio 5.000, neto caja 10.000
        $cli = Cliente::create(['empresa_id' => $this->empresa->id, 'razon_social' => 'C', 'identificacion' => '111', 'tipo_persona' => 'natural']);
        $prod = Producto::create(['empresa_id' => $this->empresa->id, 'codigo' => 'X1', 'nombre' => 'X', 'precio_venta_1' => 10000, 'iva_pct' => 0, 'existencia' => 10]);

        $this->withHeaders($this->h())->postJson('/api/ventas', [
            'tipo_documento' => 'remision', 'tipo_termino' => 'contado', 'cliente_id' => $cli->id,
            'efectivo' => 15000, 'caja_sesion_id' => $sesionId,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 1]],
        ])->assertCreated();

        // Cuadre en vivo
        $cuadre = $this->withHeaders($this->h())->getJson('/api/caja-sesion/actual')->json('sesion.cuadre');
        $this->assertEquals(10000, (float) $cuadre['ventas_contado_efectivo']);
        $this->assertEquals(60000, (float) $cuadre['total_efectivo_sistema']); // 50.000 base + 10.000

        // Cierre con conteo 59.000 → diferencia -1.000 (faltante)
        $this->withHeaders($this->h())->postJson("/api/caja-sesion/{$sesionId}/cerrar", ['conteo' => 59000])
            ->assertOk()
            ->assertJsonPath('sesion.estado', 'cerrada')
            ->assertJsonPath('sesion.diferencia_final', '-1000.00');
    }

    public function test_usa_caja_bloquea_contado_sin_sesion(): void
    {
        EmpresaConfig::where('empresa_id', $this->empresa->id)->update(['usa_caja' => 1]);
        $cli = Cliente::create(['empresa_id' => $this->empresa->id, 'razon_social' => 'C', 'identificacion' => '222', 'tipo_persona' => 'natural']);
        $prod = Producto::create(['empresa_id' => $this->empresa->id, 'codigo' => 'X2', 'nombre' => 'X', 'precio_venta_1' => 5000, 'iva_pct' => 0, 'existencia' => 10]);

        $this->withHeaders($this->h())->postJson('/api/ventas', [
            'tipo_documento' => 'remision', 'tipo_termino' => 'contado', 'cliente_id' => $cli->id,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 1]],
        ])->assertStatus(422);
    }
}
