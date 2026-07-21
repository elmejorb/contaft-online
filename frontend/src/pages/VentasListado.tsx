import { useEffect, useState } from 'react';
import { Search, RefreshCw, Printer, Ban, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { imprimirVenta } from '../lib/impresion';
import {
  PageHeader, Card, Button, Field, Input, Select, Table, Th, Td, EmptyState, Modal,
} from '../components/ui';

/* Listado de ventas / remisiones — listar, filtrar, ver detalle, reimprimir, anular. */

interface VentaRow {
  id: number;
  numero: number;
  tipo_documento: 'remision' | 'electronica' | 'soporte' | 'cotizacion';
  tipo_termino: 'contado' | 'credito';
  fecha: string;
  total: string | number;
  estado: 'valida' | 'anulada' | 'borrador';
  cliente?: { razon_social: string; identificacion: string } | null;
}
interface Linea {
  id: number; producto_id: number; descripcion_temp: string | null;
  cantidad: string | number; precio_venta: string | number; iva_pct: string | number;
  iva_monto: string | number; descuento_monto: string | number; subtotal: string | number;
  producto?: { codigo: string; nombre: string } | null;
}
interface Pago { id: number; valor: string | number; fecha: string; estado: string }
interface VentaDetalle extends VentaRow {
  dias_credito: number; subtotal: string | number; total_iva: string | number;
  descuento_global: string | number; efectivo: string | number; transferencia: string | number;
  cambio: string | number; abono_inicial: string | number; comentario: string | null;
  anulada_motivo: string | null;
  lineas: Linea[]; pagos: Pago[];
}

const TIPO_LABEL: Record<string, string> = {
  remision: 'Remisión', electronica: 'Factura Electrónica', soporte: 'Doc. Soporte', cotizacion: 'Cotización',
};
const money = (v: string | number | null | undefined) => '$ ' + Math.round(Number(v ?? 0)).toLocaleString('es-CO');
const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
const fechaCorta = (f: string) => (f ? new Date(f).toLocaleDateString('es-CO') : '');

export function VentasListadoPage() {
  const { empresaActiva } = useAuth();
  const [rows, setRows] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [estado, setEstado] = useState('');
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [anulando, setAnulando] = useState<VentaDetalle | null>(null);
  const [motivo, setMotivo] = useState('');

  async function cargar() {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { per_page: 50 };
      if (q) params.q = q;
      if (tipoDoc) params.tipo_documento = tipoDoc;
      if (estado) params.estado = estado;
      const { data } = await api.get<{ data: VentaRow[] }>('/ventas', { params });
      setRows(data.data);
    } catch (e) {
      showApiError(e, 'Error cargando ventas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tipoDoc, estado]);

  async function verDetalle(id: number) {
    try {
      const { data } = await api.get<{ venta: VentaDetalle }>(`/ventas/${id}`);
      setDetalle(data.venta);
    } catch (e) {
      showApiError(e, 'No se pudo abrir el detalle');
    }
  }

  function reimprimir(v: VentaDetalle) {
    const esCot = v.tipo_documento === 'cotizacion';
    imprimirVenta({
      numero: v.numero,
      titulo: esCot ? 'COTIZACIÓN' : TIPO_LABEL[v.tipo_documento]?.toUpperCase() || 'REMISIÓN DE VENTA',
      fecha: new Date(v.fecha).toLocaleString('es-CO'),
      tipo: v.tipo_termino === 'credito' ? 'Crédito' : 'Contado',
      dias: v.dias_credito,
      esCotizacion: esCot,
      cliente: {
        nombre: v.cliente?.razon_social ?? '', nit: v.cliente?.identificacion ?? '',
        telefono: '', direccion: '',
      },
      empresa: { nombre: empresaActiva?.razon_social ?? '', nit: empresaActiva?.nit ?? '', telefono: '', direccion: '' },
      items: v.lineas.map((l) => ({
        codigo: l.producto?.codigo ?? '',
        nombre: l.descripcion_temp || l.producto?.nombre || `Producto #${l.producto_id}`,
        cantidad: num(l.cantidad), precio: num(l.precio_venta), iva: num(l.iva_pct),
        descuento: num(l.descuento_monto), subtotal: num(l.subtotal),
      })),
      subtotal: num(v.subtotal), descuento: num(v.descuento_global), iva: num(v.total_iva), total: num(v.total),
      efectivo: num(v.efectivo), transferencia: num(v.transferencia), cambio: num(v.cambio),
      abono: num(v.abono_inicial), saldo: Math.max(num(v.total) - num(v.abono_inicial), 0),
      medioPago: '', vendedor: '',
    });
  }

  async function confirmarAnular() {
    if (!anulando) return;
    if (motivo.trim().length < 3) return toast.error('Indica el motivo de la anulación');
    try {
      await api.post(`/ventas/${anulando.id}/anular`, { motivo });
      toast.success(`Documento #${anulando.numero} anulado`);
      setAnulando(null); setMotivo(''); setDetalle(null);
      cargar();
    } catch (e) {
      showApiError(e, 'No se pudo anular');
    }
  }

  return (
    <div className="p-6">
      <PageHeader title="Ventas" subtitle="Remisiones, facturas y cotizaciones" actions={
        <Button variant="secondary" onClick={cargar}><RefreshCw size={14} /> Refrescar</Button>
      } />

      <Card className="mb-4">
        <div className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o cliente…"
              className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <Select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="w-44">
            <option value="">Todos los documentos</option>
            <option value="remision">Remisión</option>
            <option value="electronica">Factura Electrónica</option>
            <option value="cotizacion">Cotización</option>
          </Select>
          <Select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-36">
            <option value="">Todos</option>
            <option value="valida">Válidas</option>
            <option value="anulada">Anuladas</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState message="Sin ventas" hint="Las ventas que registres aparecerán aquí" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Número</Th><Th>Fecha</Th><Th>Documento</Th><Th>Cliente</Th>
                <Th className="text-right">Total</Th><Th>Estado</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className={`hover:bg-gray-50 ${v.estado === 'anulada' ? 'opacity-60' : ''}`}>
                  <Td className="font-semibold">{v.numero}</Td>
                  <Td>{fechaCorta(v.fecha)}</Td>
                  <Td>{TIPO_LABEL[v.tipo_documento] ?? v.tipo_documento}<span className="text-gray-400"> · {v.tipo_termino}</span></Td>
                  <Td>{v.cliente?.razon_social ?? '—'}</Td>
                  <Td className="text-right font-semibold">{money(v.total)}</Td>
                  <Td>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.estado === 'anulada' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {v.estado === 'anulada' ? 'ANULADA' : 'VÁLIDA'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <button onClick={() => verDetalle(v.id)} className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-xs font-semibold">
                      <Eye size={14} /> Ver
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Detalle */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={detalle ? `${TIPO_LABEL[detalle.tipo_documento] ?? ''} #${detalle.numero}` : ''}
        subtitle={detalle ? `${fechaCorta(detalle.fecha)} · ${detalle.cliente?.razon_social ?? ''}` : ''}
        size="lg"
        footer={detalle && (
          <>
            <Button variant="secondary" onClick={() => reimprimir(detalle)}><Printer size={14} /> Reimprimir</Button>
            {detalle.estado !== 'anulada' && (
              <Button variant="danger" onClick={() => { setAnulando(detalle); setMotivo(''); }}><Ban size={14} /> Anular</Button>
            )}
          </>
        )}
      >
        {detalle && (
          <div className="space-y-3">
            {detalle.estado === 'anulada' && (
              <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">
                <b>ANULADA.</b> {detalle.anulada_motivo}
              </div>
            )}
            <Table>
              <thead>
                <tr><Th>Producto</Th><Th className="text-right">Cant.</Th><Th className="text-right">Precio</Th><Th className="text-right">Desc.</Th><Th className="text-right">Subtotal</Th></tr>
              </thead>
              <tbody>
                {detalle.lineas.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.descripcion_temp || l.producto?.nombre || `#${l.producto_id}`}<span className="text-gray-400 text-[10px] block">{l.producto?.codigo}</span></Td>
                    <Td className="text-right">{num(l.cantidad)}</Td>
                    <Td className="text-right">{money(l.precio_venta)}</Td>
                    <Td className="text-right">{money(l.descuento_monto)}</Td>
                    <Td className="text-right font-semibold">{money(l.subtotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <Row label="Subtotal" value={money(detalle.subtotal)} />
                <Row label="IVA" value={money(detalle.total_iva)} />
                {num(detalle.descuento_global) > 0 && <Row label="Descuento" value={money(detalle.descuento_global)} />}
                <div className="flex justify-between font-bold text-primary-700 border-t pt-1"><span>TOTAL</span><span>{money(detalle.total)}</span></div>
                {detalle.tipo_termino === 'credito'
                  ? <Row label="Abono inicial" value={money(detalle.abono_inicial)} />
                  : <Row label="Cambio" value={money(detalle.cambio)} />}
              </div>
            </div>
            {detalle.comentario && <div className="text-xs text-gray-500">Nota: {detalle.comentario}</div>}
          </div>
        )}
      </Modal>

      {/* Anular */}
      <Modal
        open={!!anulando}
        onClose={() => setAnulando(null)}
        title={anulando ? `Anular documento #${anulando.numero}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnulando(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarAnular}><Ban size={14} /> Anular</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-600">
            Anular reversa el inventario (kardex) y saca el documento de cartera. Esta acción no se puede deshacer.
          </div>
          <Field label="Motivo de anulación" required>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. error en cantidades" autoFocus />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-medium">{value}</span></div>;
}
