<?php

namespace Tests\Feature;

use App\Models\Landlord\Empresa;
use App\Models\Landlord\Usuario;
use App\Models\Tenant\Cliente;
use App\Models\Tenant\EmpresaConfig;
use App\Models\Tenant\Producto;
use App\Models\Tenant\Venta;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Integración end-to-end del POST /api/ventas: pasa por Sanctum + ResolveTenant
 * + EmpresaScope, calcula server-side, afecta kardex y numera por tipo.
 *
 * Corre contra la BD de prueba contaft_online_test (ver phpunit.xml). Cada test
 * se envuelve en transacción y se revierte — NO ensucia datos.
 */
class VentaStoreTest extends TestCase
{
    use DatabaseTransactions;

    private Empresa $empresa;
    private Usuario $usuario;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = DB::connection('landlord')->table('planes')->where('slug', 'trial')->first()
            ?? DB::connection('landlord')->table('planes')->first();

        $this->empresa = Empresa::create([
            'razon_social'   => 'EMPRESA TEST SAS',
            'nit'            => '900123456',
            'email_contacto' => 'test@empresa.com',
            'bd_name'        => 'contaft_online_test',
            'plan_id'        => $plan->id,
            'trial_hasta'    => now()->addDays(30),
            'activa'         => 1,
        ]);

        EmpresaConfig::create([
            'empresa_id'                 => $this->empresa->id,
            'iva_incluido'               => 1,
            'iniciar_factura_en'         => 1,
            'permitir_facturar_negativo' => 0,
        ]);

        $this->usuario = Usuario::create([
            'nombre'        => 'Cajero Test',
            'email'         => 'cajero@test.com',
            'password_hash' => bcrypt('secret123'),
            'activo'        => 1,
        ]);
        $this->usuario->empresas()->attach($this->empresa->id, [
            'rol' => 'admin', 'empresa_default' => 1, 'activo' => 1,
        ]);
    }

    private function cliente(array $overrides = []): Cliente
    {
        return Cliente::create(array_merge([
            'empresa_id'     => $this->empresa->id,
            'razon_social'   => 'Cliente Test',
            'identificacion' => '123456789',
            'tipo_persona'   => 'natural',
        ], $overrides));
    }

    private function producto(array $overrides = []): Producto
    {
        static $n = 0;
        $n++;
        return Producto::create(array_merge([
            'empresa_id'     => $this->empresa->id,
            'codigo'         => 'P' . $n,
            'nombre'         => 'Producto ' . $n,
            'precio_costo'   => 5000,
            'precio_venta_1' => 11900,
            'iva_pct'        => 19,
            'existencia'     => 10,
        ], $overrides));
    }

    /** Autentica como el usuario y adjunta la empresa activa. */
    private function comoUsuario(): void
    {
        Sanctum::actingAs($this->usuario, ['*']);
    }

    private function headers(): array
    {
        return ['X-Empresa-Id' => (string) $this->empresa->id, 'Accept' => 'application/json'];
    }

    public function test_crea_venta_contado_con_totales_e_impacto_en_kardex(): void
    {
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 10]);

        $resp = $this->withHeaders($this->headers())->postJson('/api/ventas', [
            'tipo_documento' => 'remision',
            'tipo_termino'   => 'contado',
            'cliente_id'     => $cli->id,
            'efectivo'       => 20000,
            'lineas' => [
                ['producto_id' => $prod->id, 'cantidad' => 1],
            ],
        ]);

        $resp->assertCreated();
        $resp->assertJsonPath('venta.subtotal', '11900.00');
        $resp->assertJsonPath('venta.total_iva', '1900.00');
        $resp->assertJsonPath('venta.total', '11900.00');
        $resp->assertJsonPath('venta.cambio', '8100.00');   // 20000 - 11900

        // Kardex: una salida por la venta; existencia descontada a 9.
        $this->assertDatabaseHas('kardex', [
            'empresa_id'      => $this->empresa->id,
            'producto_id'     => $prod->id,
            'tipo'            => 'salida',
            'cantidad_salida' => '1.000',
        ]);
        $this->assertEquals(9.0, (float) $prod->fresh()->existencia);
    }

    public function test_cotizacion_no_afecta_inventario(): void
    {
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 5]);

        $this->withHeaders($this->headers())->postJson('/api/ventas', [
            'tipo_documento' => 'cotizacion',
            'cliente_id'     => $cli->id,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 2]],
        ])->assertCreated();

        $this->assertEquals(5.0, (float) $prod->fresh()->existencia);   // sin cambio
        $this->assertDatabaseMissing('kardex', [
            'empresa_id'  => $this->empresa->id,
            'producto_id' => $prod->id,
        ]);
    }

    public function test_bloquea_por_stock_insuficiente_cuando_no_permite_negativo(): void
    {
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 1]);

        $this->withHeaders($this->headers())->postJson('/api/ventas', [
            'tipo_documento' => 'remision',
            'cliente_id'     => $cli->id,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 5]],
        ])->assertStatus(422);

        $this->assertEquals(1.0, (float) $prod->fresh()->existencia);   // no se tocó
    }

    public function test_numeracion_consecutiva_por_tipo_documento(): void
    {
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 100]);

        $linea = [['producto_id' => $prod->id, 'cantidad' => 1]];

        $pos1 = $this->withHeaders($this->headers())->postJson('/api/ventas', ['tipo_documento' => 'remision', 'cliente_id' => $cli->id, 'lineas' => $linea]);
        $pos2 = $this->withHeaders($this->headers())->postJson('/api/ventas', ['tipo_documento' => 'remision', 'cliente_id' => $cli->id, 'lineas' => $linea]);
        $cot1 = $this->withHeaders($this->headers())->postJson('/api/ventas', ['tipo_documento' => 'cotizacion', 'cliente_id' => $cli->id, 'lineas' => $linea]);

        $pos1->assertJsonPath('venta.numero', 1);
        $pos2->assertJsonPath('venta.numero', 2);
        $cot1->assertJsonPath('venta.numero', 1);   // secuencia propia de cotización
    }

    public function test_venta_credito_crea_pago_y_aparece_en_cartera(): void
    {
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 10, 'precio_venta_1' => 11900]);

        $this->withHeaders($this->headers())->postJson('/api/ventas', [
            'tipo_documento' => 'remision',
            'tipo_termino'   => 'credito',
            'dias_credito'   => 30,
            'cliente_id'     => $cli->id,
            'abono_inicial'  => 10000,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 1]],
        ])->assertCreated();

        // El abono inicial creó una fila en pagos.
        $this->assertDatabaseHas('pagos', [
            'empresa_id' => $this->empresa->id,
            'cliente_id' => $cli->id,
            'valor'      => '10000.00',
            'estado'     => 'valida',
        ]);

        // Cartera: saldo = total (11900) - abono (10000) = 1900.
        $saldo = DB::connection('landlord')->table('vw_facturas_saldo')
            ->where('empresa_id', $this->empresa->id)->value('saldo');
        $this->assertEquals(1900.0, (float) $saldo);
    }

    public function test_aislamiento_no_ve_ventas_de_otra_empresa(): void
    {
        // Venta de la empresa A
        $this->comoUsuario();
        $cli = $this->cliente();
        $prod = $this->producto(['existencia' => 10]);
        $this->withHeaders($this->headers())->postJson('/api/ventas', [
            'tipo_documento' => 'remision', 'cliente_id' => $cli->id,
            'lineas' => [['producto_id' => $prod->id, 'cantidad' => 1]],
        ])->assertCreated();

        // Empresa B con su propio usuario
        $empresaB = Empresa::create([
            'razon_social' => 'OTRA SAS', 'nit' => '900999888',
            'email_contacto' => 'b@b.com', 'bd_name' => 'contaft_online_test_b',
            'plan_id' => $this->empresa->plan_id, 'trial_hasta' => now()->addDays(30), 'activa' => 1,
        ]);
        EmpresaConfig::create(['empresa_id' => $empresaB->id, 'iva_incluido' => 1, 'iniciar_factura_en' => 1]);
        $usuarioB = Usuario::create(['nombre' => 'B', 'email' => 'ub@test.com', 'password_hash' => bcrypt('x'), 'activo' => 1]);
        $usuarioB->empresas()->attach($empresaB->id, ['rol' => 'admin', 'empresa_default' => 1, 'activo' => 1]);

        Sanctum::actingAs($usuarioB, ['*']);
        $resp = $this->withHeaders(['X-Empresa-Id' => (string) $empresaB->id, 'Accept' => 'application/json'])
            ->getJson('/api/ventas');

        $resp->assertOk();
        $this->assertSame(0, (int) $resp->json('total'));   // B no ve las ventas de A
    }
}
