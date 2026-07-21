import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellStyle } from 'ag-grid-community';
import {
  Search, RefreshCw, TrendingUp, DollarSign, CreditCard, Wallet, Eye, X, Printer, Copy, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { imprimirVenta } from '../lib/impresion';
import { Button, Field, Input, Table, Th, Td, Modal } from '../components/ui';

ModuleRegistry.registerModules([AllCommunityModule]);

/* Listado de Ventas — port del SalesManagement del desktop (AG Grid + tarjetas). */

interface VentaRow {
  id: number; numero: number;
  tipo_documento: 'remision' | 'electronica' | 'soporte' | 'cotizacion';
  tipo_termino: 'contado' | 'credito';
  fecha: string; total: string | number; estado: 'valida' | 'anulada' | 'borrador';
  lineas_count: number; saldo: string | number | null; medio_pago_nombre: string | null;
  cliente?: { razon_social: string; identificacion: string } | null;
}
interface Linea {
  id: number; producto_id: number; descripcion_temp: string | null;
  cantidad: string | number; precio_venta: string | number; iva_pct: string | number;
  descuento_monto: string | number; subtotal: string | number;
  producto?: { codigo: string; nombre: string } | null;
}
interface VentaDetalle extends VentaRow {
  dias_credito: number; subtotal: string | number; total_iva: string | number;
  descuento_global: string | number; efectivo: string | number; transferencia: string | number;
  cambio: string | number; abono_inicial: string | number; comentario: string | null;
  anulada_motivo: string | null; lineas: Linea[];
}

const TIPO_LABEL: Record<string, string> = {
  remision: 'Remisión', electronica: 'F. Electrónica', soporte: 'Doc. Soporte', cotizacion: 'Cotización',
};
const DOC_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  remision:    { label: 'Remisión',       bg: '#f3f4f6', color: '#374151' },
  electronica: { label: 'F. Electrónica', bg: '#dbeafe', color: '#2563eb' },
  soporte:     { label: 'Doc. Soporte',   bg: '#fef3c7', color: '#92400e' },
  cotizacion:  { label: 'Cotización',     bg: '#ede9fe', color: '#7c3aed' },
};
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
const fmtMon = (v: string | number | null | undefined) => '$ ' + Math.round(num(v)).toLocaleString('es-CO');
const fechaCorta = (f: string) => (f ? new Date(f).toLocaleDateString('es-CO') : '-');
const fmtHora = (f: string) => (f ? new Date(f).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }) : '');

export function VentasListadoPage() {
  const { empresaActiva } = useAuth();
  const hoy = new Date();
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [anios, setAnios] = useState<number[]>([hoy.getFullYear()]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [dia, setDia] = useState(0);
  const [estado, setEstado] = useState('valida');
  const [filtroDoc, setFiltroDoc] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'contado' | 'credito'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [anulando, setAnulando] = useState<VentaRow | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { anio, estado };
      if (mes > 0) params.mes = mes;
      if (dia > 0) params.dia = dia;
      const { data } = await api.get<{ ventas: VentaRow[]; anios: number[] }>('/ventas', { params });
      setVentas(data.ventas);
      if (data.anios?.length) setAnios(data.anios);
    } catch (e) {
      showApiError(e, 'Error cargando ventas');
    } finally {
      setLoading(false);
    }
  }, [anio, mes, dia, estado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (mes === 0 && dia !== 0) setDia(0); }, [mes, dia]);

  const filtrados = useMemo(() => ventas.filter((v) => {
    if (filtroDoc && v.tipo_documento !== filtroDoc) return false;
    if (filtroTipo === 'contado' && v.tipo_termino !== 'contado') return false;
    if (filtroTipo === 'credito' && v.tipo_termino !== 'credito') return false;
    if (busqueda) {
      const b = busqueda.toLowerCase();
      const ok = String(v.numero).includes(busqueda)
        || v.cliente?.razon_social?.toLowerCase().includes(b)
        || v.cliente?.identificacion?.toLowerCase().includes(b);
      if (!ok) return false;
    }
    return true;
  }), [ventas, filtroTipo, busqueda]);

  // Las cotizaciones NO son ventas → se excluyen de los montos y del conteo.
  const stats = useMemo(() => filtrados.reduce((a, v) => {
    if (v.tipo_documento === 'cotizacion') return a;
    a.cantidad += 1; a.monto += num(v.total);
    if (v.tipo_termino === 'contado') a.contado += num(v.total); else a.credito += num(v.total);
    return a;
  }, { cantidad: 0, monto: 0, contado: 0, credito: 0 }), [filtrados]);

  const verDetalle = useCallback(async (id: number) => {
    try {
      const { data } = await api.get<{ venta: VentaDetalle }>(`/ventas/${id}`);
      setDetalle(data.venta);
    } catch (e) { showApiError(e, 'No se pudo abrir el detalle'); }
  }, []);

  const construirImpresion = useCallback((v: VentaDetalle) => {
    const esCot = v.tipo_documento === 'cotizacion';
    imprimirVenta({
      numero: v.numero,
      titulo: esCot ? 'COTIZACIÓN' : 'REMISIÓN DE VENTA',
      fecha: new Date(v.fecha).toLocaleString('es-CO'),
      tipo: v.tipo_termino === 'credito' ? 'Crédito' : 'Contado',
      dias: v.dias_credito, esCotizacion: esCot,
      cliente: { nombre: v.cliente?.razon_social ?? '', nit: v.cliente?.identificacion ?? '', telefono: '', direccion: '' },
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
      medioPago: v.medio_pago_nombre ?? '', vendedor: '',
    });
  }, [empresaActiva]);

  const imprimirDesde = useCallback(async (id: number) => {
    try {
      const { data } = await api.get<{ venta: VentaDetalle }>(`/ventas/${id}`);
      construirImpresion(data.venta);
    } catch (e) { showApiError(e, 'No se pudo imprimir'); }
  }, [construirImpresion]);

  async function confirmarAnular() {
    if (!anulando) return;
    if (motivo.trim().length < 3) return toast.error('Indica el motivo de la anulación');
    try {
      await api.post(`/ventas/${anulando.id}/anular`, { motivo });
      toast.success(`Documento #${anulando.numero} anulado`);
      setAnulando(null); setMotivo(''); setDetalle(null); cargar();
    } catch (e) { showApiError(e, 'No se pudo anular'); }
  }

  const cols = useMemo<ColDef<VentaRow>[]>(() => [
    { headerName: 'Factura', field: 'numero', width: 95, sortable: true,
      cellRenderer: (p: any) => <span style={{ color: '#7c3aed', fontWeight: 600 }}>{p.value}</span> },
    { headerName: 'Fecha', field: 'fecha', width: 110, sortable: true, cellRenderer: (p: any) => fechaCorta(p.value) },
    { headerName: 'Hora', field: 'fecha', colId: 'hora', width: 95, cellRenderer: (p: any) => fmtHora(p.value) },
    { headerName: 'Cliente', valueGetter: (p) => p.data?.cliente?.razon_social ?? '—', flex: 1, minWidth: 160, sortable: true, filter: true },
    { headerName: 'Documento', field: 'tipo_documento', width: 130, sortable: true, cellRenderer: (p: any) => {
        const b = DOC_BADGE[p.value] ?? { label: p.value, bg: '#f3f4f6', color: '#374151' };
        return <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: b.bg, color: b.color }}>{b.label}</span>;
      } },
    { headerName: 'Término', field: 'tipo_termino', width: 95, cellRenderer: (p: any) => {
        const cred = p.value === 'credito';
        return <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cred ? '#dbeafe' : '#f3f4f6', color: cred ? '#2563eb' : '#6b7280' }}>{cred ? 'Crédito' : 'Contado'}</span>;
      } },
    { headerName: 'Ítems', field: 'lineas_count', width: 80, cellStyle: { textAlign: 'center' } as CellStyle },
    { headerName: 'Total', field: 'total', width: 135, sortable: true, cellStyle: { textAlign: 'right' } as CellStyle,
      cellRenderer: (p: any) => <span style={{ fontWeight: 700 }}>{fmtMon(p.value)}</span> },
    { headerName: 'Saldo', field: 'saldo', width: 120, sortable: true, cellStyle: { textAlign: 'right' } as CellStyle,
      cellRenderer: (p: any) => num(p.value) > 0
        ? <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmtMon(p.value)}</span>
        : <span style={{ color: '#16a34a' }}>$ 0</span> },
    { headerName: 'Medio', field: 'medio_pago_nombre', width: 115,
      cellRenderer: (p: any) => p.value ? <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6' }}>{p.value}</span> : '—' },
    { headerName: '', width: 140, sortable: false, pinned: 'right',
      cellStyle: { display: 'flex', alignItems: 'center', gap: 4 } as CellStyle,
      cellRenderer: (p: any) => {
        const anulada = p.data?.estado === 'anulada';
        const btn = { background: 'none', border: 'none', cursor: 'pointer', padding: 3 } as const;
        return (
          <div style={{ display: 'flex', gap: 2 }}>
            <button title="Ver detalle" style={btn} onClick={() => verDetalle(p.data.id)}><Eye size={15} color="#7c3aed" /></button>
            <button title="Imprimir" style={btn} onClick={() => imprimirDesde(p.data.id)}><Printer size={15} color="#2563eb" /></button>
            <button title="Copiar a Nueva Venta (próximamente)" style={btn} onClick={() => toast('Próximamente: copiar a nueva venta')}><Copy size={15} color="#16a34a" /></button>
            {!anulada && <button title="Anular" style={btn} onClick={() => { setAnulando(p.data); setMotivo(''); }}><Ban size={15} color="#dc2626" /></button>}
          </div>
        );
      } },
  ], [verDetalle, imprimirDesde]);

  const statCards = [
    { label: 'Total Facturas', value: String(stats.cantidad), icon: TrendingUp, bg: '#f3e8ff', color: '#7c3aed' },
    { label: 'Monto Total', value: fmtMon(stats.monto), icon: DollarSign, bg: '#dcfce7', color: '#16a34a' },
    { label: 'Contado', value: fmtMon(stats.contado), icon: Wallet, bg: '#f3f4f6', color: '#374151' },
    { label: 'Crédito', value: fmtMon(stats.credito), icon: CreditCard, bg: '#dbeafe', color: '#2563eb' },
  ];

  const inputCss: React.CSSProperties = { height: 30, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, padding: '0 6px', background: '#fff' };

  return (
    <div className="p-6">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937' }}>Listado de Ventas</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Consulta y gestión de documentos de venta</p>
      </div>

      {/* Tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={s.color} /></div>
              <div><div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div></div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '10px 16px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select value={anio} onChange={(e) => setAnio(parseInt(e.target.value))} style={inputCss}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))} style={inputCss}>
          <option value={0}>Mes (todos)</option>
          {MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={dia} onChange={(e) => setDia(parseInt(e.target.value))} disabled={mes === 0}
          style={{ ...inputCss, opacity: mes === 0 ? 0.5 : 1 }}>
          <option value={0}>Día (todos)</option>
          {Array.from({ length: new Date(anio, mes, 0).getDate() || 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputCss}>
          <option value="valida">Válidas</option>
          <option value="anulada">Anuladas</option>
          <option value="todas">Todas</option>
        </select>
        <select value={filtroDoc} onChange={(e) => setFiltroDoc(e.target.value)} style={inputCss} title="Tipo de documento">
          <option value="">Todos los docs</option>
          <option value="remision">Remisión</option>
          <option value="electronica">F. Electrónica</option>
          <option value="soporte">Doc. Soporte</option>
          <option value="cotizacion">Cotización</option>
        </select>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="# Factura, cliente o identificación…"
            style={{ width: '100%', height: 30, paddingLeft: 28, paddingRight: busqueda ? 26 : 8, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>}
        </div>
        {(['todos', 'contado', 'credito'] as const).map((f) => (
          <button key={f} onClick={() => setFiltroTipo(f)} style={{
            height: 28, padding: '0 12px', fontSize: 11, borderRadius: 6, cursor: 'pointer', textTransform: 'capitalize',
            border: filtroTipo === f ? '1px solid #7c3aed' : '1px solid #e5e7eb',
            background: filtroTipo === f ? '#f3e8ff' : '#fff', color: filtroTipo === f ? '#7c3aed' : '#374151', fontWeight: filtroTipo === f ? 600 : 400,
          }}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>{filtrados.length} doc(s)</span>
        <button onClick={cargar} style={{ height: 30, padding: '0 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><RefreshCw size={14} /></button>
      </div>

      {/* Grid */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ height: 'calc(100vh - 380px)', minHeight: 320, width: '100%', ['--ag-font-family' as any]: 'inherit', ['--ag-font-size' as any]: '13px' }}>
          <AgGridReact<VentaRow>
            rowData={filtrados} columnDefs={cols} loading={loading} animateRows
            getRowId={(p) => String(p.data.id)} rowHeight={34} headerHeight={34}
            defaultColDef={{ resizable: true }}
            getRowStyle={(p) => p.data?.estado === 'anulada' ? { background: '#fef2f2', textDecoration: 'line-through', opacity: 0.65 } : undefined}
          />
        </div>
      </div>

      {/* Detalle */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)}
        title={detalle ? `${TIPO_LABEL[detalle.tipo_documento] ?? ''} #${detalle.numero}` : ''}
        subtitle={detalle ? `${fechaCorta(detalle.fecha)} · ${detalle.cliente?.razon_social ?? ''}` : ''}
        size="lg"
        footer={detalle && (
          <>
            <Button variant="secondary" onClick={() => construirImpresion(detalle)}><Printer size={14} /> Reimprimir</Button>
            {detalle.estado !== 'anulada' && <Button variant="danger" onClick={() => { setAnulando(detalle); setMotivo(''); }}><Ban size={14} /> Anular</Button>}
          </>
        )}>
        {detalle && (
          <div className="space-y-3">
            {detalle.estado === 'anulada' && <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2"><b>ANULADA.</b> {detalle.anulada_motivo}</div>}
            <Table>
              <thead><tr><Th>Producto</Th><Th className="text-right">Cant.</Th><Th className="text-right">Precio</Th><Th className="text-right">Desc.</Th><Th className="text-right">Subtotal</Th></tr></thead>
              <tbody>
                {detalle.lineas.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.descripcion_temp || l.producto?.nombre || `#${l.producto_id}`}<span className="text-gray-400 text-[10px] block">{l.producto?.codigo}</span></Td>
                    <Td className="text-right">{num(l.cantidad)}</Td>
                    <Td className="text-right">{fmtMon(l.precio_venta)}</Td>
                    <Td className="text-right">{fmtMon(l.descuento_monto)}</Td>
                    <Td className="text-right font-semibold">{fmtMon(l.subtotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmtMon(detalle.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">IVA</span><span>{fmtMon(detalle.total_iva)}</span></div>
                <div className="flex justify-between font-bold text-primary-700 border-t pt-1"><span>TOTAL</span><span>{fmtMon(detalle.total)}</span></div>
                {detalle.tipo_termino === 'credito'
                  ? <div className="flex justify-between"><span className="text-gray-500">Abono</span><span>{fmtMon(detalle.abono_inicial)}</span></div>
                  : <div className="flex justify-between"><span className="text-gray-500">Cambio</span><span>{fmtMon(detalle.cambio)}</span></div>}
              </div>
            </div>
            {detalle.comentario && <div className="text-xs text-gray-500">Nota: {detalle.comentario}</div>}
          </div>
        )}
      </Modal>

      {/* Anular */}
      <Modal open={!!anulando} onClose={() => setAnulando(null)} title={anulando ? `Anular documento #${anulando.numero}` : ''} size="sm"
        footer={<><Button variant="secondary" onClick={() => setAnulando(null)}>Cancelar</Button><Button variant="danger" onClick={confirmarAnular}><Ban size={14} /> Anular</Button></>}>
        <div className="space-y-3">
          <div className="text-xs text-gray-600">Anular reversa el inventario (kardex) y saca el documento de cartera. No se puede deshacer.</div>
          <Field label="Motivo de anulación" required><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. error en cantidades" autoFocus /></Field>
        </div>
      </Modal>
    </div>
  );
}
