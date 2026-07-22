import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2, Plus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { imprimirVenta } from '../lib/impresion';

/* ================================================================
 * Nueva Venta / POS — port 1:1 del NuevaVenta.tsx del desktop
 * (estilos inline, layout denso tipo hoja de cálculo). Recableado
 * al backend online (Laravel). Los TOTALES se calculan aquí solo
 * para mostrar; el servidor (VentaCalculator) recalcula al guardar.
 *
 * Fuera de alcance (subfases siguientes): envío real a DIAN,
 * caja, retenciones en pantalla, contingencia.
 * ============================================================== */

const fmtMon = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v ?? 0) || 0).toLocaleString('es-CO');
const toNum = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
const soloNum = (e: React.KeyboardEvent) => {
  const allow = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End'];
  if (allow.includes(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/[0-9.]/.test(e.key)) e.preventDefault();
};

interface ProductoApi {
  id: number; codigo: string; nombre: string;
  precio_venta_1: string | number; precio_venta_2: string | number; precio_venta_3: string | number;
  precio_costo: string | number; iva_pct: string | number;
  es_servicio: boolean; existencia: string | number;
}
interface ClienteApi { id: number; razon_social: string; identificacion: string; telefono: string | null; cupo_credito: string | number; dias_credito: number }
interface MedioPago { id: number; nombre: string }

interface Cliente { id: number | null; nombre: string; nit: string; tel: string; cupo: number; esCliente: boolean }
interface Linea {
  id: string; producto_id: number; codigo: string; nombre: string; esServicio: boolean;
  existencia: number; cantidad: number; precioVenta: number; descuento: number; iva: number;
  precioCosto: number; descripcionTemp?: string;
}

const CLIENTE_VACIO: Cliente = { id: null, nombre: '', nit: '', tel: '', cupo: 0, esCliente: false };

export function VentasPage() {
  const { empresaActiva } = useAuth();
  const [ivaIncluido, setIvaIncluido] = useState(true);
  const [usaFe, setUsaFe] = useState(false);
  const [usaCaja, setUsaCaja] = useState(false);
  const [cajaSesion, setCajaSesion] = useState<{ id: number; caja?: { nombre: string } } | null>(null);
  const [medios, setMedios] = useState<MedioPago[]>([]);

  const [tipoDocumento, setTipoDocumento] = useState<'remision' | 'electronica' | 'cotizacion'>('remision');
  const [tipo, setTipo] = useState<'Contado' | 'Crédito'>('Contado');
  const [dias, setDias] = useState(0);
  const [listaPrecio, setListaPrecio] = useState<1 | 2 | 3>(1);
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_VACIO);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [nota, setNota] = useState('');

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // pago
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');
  const [pagoMedioTransf, setPagoMedioTransf] = useState<number>(0);
  const [pagoAbono, setPagoAbono] = useState('');

  const esCotizacion = tipoDocumento === 'cotizacion';

  useEffect(() => {
    api.get<{ config: { iva_incluido: boolean; usa_fe: boolean; usa_caja: boolean } }>('/empresa-config')
      .then(({ data }) => {
        setIvaIncluido(!!data.config?.iva_incluido);
        setUsaFe(!!data.config?.usa_fe);
        setUsaCaja(!!data.config?.usa_caja);
      }).catch(() => {});
    api.get<{ sesion: { id: number; caja?: { nombre: string } } | null }>('/caja-sesion/actual')
      .then(({ data }) => setCajaSesion(data.sesion)).catch(() => {});
    api.get<{ medios_pago: MedioPago[] }>('/medios-pago')
      .then(({ data }) => { setMedios(data.medios_pago); if (data.medios_pago[0]) setPagoMedioTransf(data.medios_pago[0].id); })
      .catch(() => {});
    // Cliente por defecto: CONSUMIDOR FINAL (222222222222)
    api.get<{ data: ClienteApi[] }>('/clientes', { params: { q: '222222222222', per_page: 1 } })
      .then(({ data }) => { if (data.data[0]) seleccionarCliente(data.data[0]); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- líneas ----------
  function precioLista(p: ProductoApi): number {
    if (listaPrecio === 2) return toNum(p.precio_venta_2) || toNum(p.precio_venta_1);
    if (listaPrecio === 3) return toNum(p.precio_venta_3) || toNum(p.precio_venta_1);
    return toNum(p.precio_venta_1);
  }
  function agregarProducto(p: ProductoApi) {
    setLineas((prev) => {
      const existe = prev.find((l) => l.producto_id === p.id && !l.esServicio);
      if (existe) return prev.map((l) => (l.id === existe.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...prev, {
        id: `${p.id}-${prev.length}-${Math.round(toNum(p.precio_costo))}`,
        producto_id: p.id, codigo: p.codigo, nombre: p.nombre, esServicio: !!p.es_servicio,
        existencia: toNum(p.existencia), cantidad: 1, precioVenta: precioLista(p),
        descuento: 0, iva: toNum(p.iva_pct), precioCosto: toNum(p.precio_costo),
      }];
    });
  }
  function actualizarLinea(id: string, campo: keyof Linea, valor: number) {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }
  function eliminarLinea(id: string) { setLineas((prev) => prev.filter((l) => l.id !== id)); }

  const subtotalLinea = (l: Linea) => l.cantidad * l.precioVenta - l.descuento;

  // ---------- totales (display) ----------
  const { totalIva, total } = useMemo(() => {
    let sub = 0, iva = 0;
    for (const l of lineas) {
      const s = subtotalLinea(l);
      sub += s;
      if (l.iva > 0) iva += ivaIncluido ? s * (l.iva / (100 + l.iva)) : s * (l.iva / 100);
    }
    const t = ivaIncluido ? sub - descuentoGlobal : sub + iva - descuentoGlobal;
    return { subtotal: sub, totalIva: iva, total: Math.max(t, 0) };
  }, [lineas, ivaIncluido, descuentoGlobal]);

  const pagoEfectivoNum = parseInt(pagoEfectivo || '0');
  const pagoTransfNum = parseInt(pagoTransferencia || '0');
  const pagoAbonoNum = parseInt(pagoAbono || '0');
  const totalPagado = pagoEfectivoNum + pagoTransfNum;
  const cambioPago = Math.max(totalPagado - total, 0);
  const faltaPagar = Math.max(total - totalPagado, 0);

  // ---------- acciones ----------
  function seleccionarCliente(c: ClienteApi) {
    setCliente({
      id: c.id, nombre: c.razon_social, nit: c.identificacion, tel: c.telefono ?? '',
      cupo: toNum(c.cupo_credito), esCliente: true,
    });
    if (dias === 0 && c.dias_credito) setDias(c.dias_credito);
    setShowClienteModal(false);
  }
  function nueva() {
    setLineas([]); setDescuentoGlobal(0); setNota('');
    setPagoEfectivo(''); setPagoTransferencia(''); setPagoAbono('');
  }
  function finalizar() {
    if (!cliente.id) return toast.error('Selecciona un cliente');
    if (lineas.length === 0) return toast.error('Agrega al menos un producto');
    if (tipo === 'Crédito' && !cliente.esCliente) return toast.error('Selecciona un cliente real para crédito');
    if (usaCaja && !esCotizacion && tipo === 'Contado' && !cajaSesion) {
      return toast.error('Abre una caja para vender de contado (módulo Caja).');
    }
    if (esCotizacion) { confirmarVenta(); return; }
    setShowPagoModal(true);
  }

  // F9 = Finalizar (atajo del desktop). Ref para evitar closures obsoletos.
  const finalizarRef = useRef(finalizar);
  finalizarRef.current = finalizar;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); finalizarRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function confirmarVenta() {
    if (tipo === 'Contado' && !esCotizacion && faltaPagar > 0) return toast.error('Falta completar el pago');
    setGuardando(true);
    try {
      const payload = {
        tipo_documento: tipoDocumento,
        tipo_termino: esCotizacion ? 'contado' : tipo === 'Crédito' ? 'credito' : 'contado',
        dias_credito: tipo === 'Crédito' ? dias : 0,
        cliente_id: cliente.id,
        lista_precio: listaPrecio,
        descuento_global: descuentoGlobal,
        comentario: nota || null,
        medio_pago_id: pagoTransfNum > 0 ? pagoMedioTransf : (medios[0]?.id ?? null),
        efectivo: tipo === 'Contado' && !esCotizacion ? pagoEfectivoNum : 0,
        transferencia: tipo === 'Contado' && !esCotizacion ? pagoTransfNum : 0,
        abono_inicial: tipo === 'Crédito' ? pagoAbonoNum : 0,
        caja_sesion_id: cajaSesion?.id ?? null,
        lineas: lineas.map((l) => ({
          producto_id: l.producto_id, cantidad: l.cantidad, precio_venta: l.precioVenta,
          descuento: l.descuento, iva_pct: l.iva,
          descripcion_temp: l.esServicio ? (l.descripcionTemp || l.nombre) : null,
        })),
      };
      const { data } = await api.post<{ venta: { numero: number } }>('/ventas', payload);
      const numero = data.venta.numero;
      toast.success(`${esCotizacion ? 'Cotización' : 'Remisión'} #${numero} guardada`);

      // Impresión (vista previa) con los datos de la venta recién guardada,
      // antes de limpiar el formulario.
      imprimirVenta({
        numero,
        titulo: esCotizacion ? 'COTIZACIÓN' : 'REMISIÓN DE VENTA',
        fecha: new Date().toLocaleString('es-CO'),
        tipo,
        dias: tipo === 'Crédito' ? dias : 0,
        esCotizacion,
        cliente: { nombre: cliente.nombre, nit: cliente.nit, telefono: cliente.tel, direccion: '' },
        empresa: { nombre: empresaActiva?.razon_social ?? '', nit: empresaActiva?.nit ?? '', telefono: '', direccion: '' },
        items: lineas.map((l) => ({
          codigo: l.codigo,
          nombre: l.esServicio ? (l.descripcionTemp || l.nombre) : l.nombre,
          cantidad: l.cantidad, precio: l.precioVenta, iva: l.iva, descuento: l.descuento,
          subtotal: subtotalLinea(l),
        })),
        subtotal: lineas.reduce((s, l) => s + subtotalLinea(l), 0),
        descuento: descuentoGlobal,
        iva: totalIva,
        total,
        efectivo: pagoEfectivoNum,
        transferencia: pagoTransfNum,
        cambio: cambioPago,
        abono: pagoAbonoNum,
        saldo: Math.max(total - pagoAbonoNum, 0),
        medioPago: medios.find((m) => m.id === pagoMedioTransf)?.nombre ?? '',
        vendedor: '',
      });

      setShowPagoModal(false);
      nueva();
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  const docColor = tipoDocumento === 'electronica' ? { c: '#2563eb', b: '#eff6ff' }
    : tipoDocumento === 'cotizacion' ? { c: '#1d4ed8', b: '#dbeafe' } : { c: '#374151', b: '#fff' };

  const lbl: React.CSSProperties = { fontSize: 9, color: '#6b7280', display: 'block', marginBottom: 2 };
  const inp: React.CSSProperties = { height: 28, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, padding: '0 6px', outline: 'none' };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '8px 16px', marginBottom: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', padding: 12 }}>
      {usaCaja && !cajaSesion && (
        <div style={{ marginBottom: 6, padding: '6px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠ No hay una caja abierta — no podrás registrar ventas de contado.</span>
          <Link to="/caja" style={{ color: '#7c3aed', fontWeight: 700 }}>Abrir caja →</Link>
        </div>
      )}
      {cajaSesion && (
        <div style={{ marginBottom: 6, fontSize: 11, color: '#16a34a' }}>
          🟢 Caja abierta: <b>{cajaSesion.caja?.nombre ?? ''}</b>
        </div>
      )}
      {/* Fila 1: Datos factura */}
      <div style={{ ...card, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <label style={lbl}>DOCUMENTO</label>
          <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as typeof tipoDocumento)}
            style={{ ...inp, width: 150, fontWeight: 600, color: docColor.c, background: docColor.b }}>
            <option value="remision">Remisión</option>
            {usaFe && <option value="electronica">Factura Electrónica</option>}
            <option value="cotizacion">Cotización</option>
          </select>
        </div>
        <div>
          <label style={lbl}>TÉRMINO</label>
          <select value={tipo} disabled={esCotizacion}
            onChange={(e) => { const t = e.target.value as 'Contado' | 'Crédito'; setTipo(t); if (t === 'Contado') setDias(0); else if (!dias) setDias(30); }}
            style={{ ...inp, width: 90 }}>
            <option value="Contado">Contado</option>
            <option value="Crédito">Crédito</option>
          </select>
        </div>
        {tipo === 'Crédito' && !esCotizacion && (
          <div>
            <label style={lbl}>DÍAS</label>
            <input type="text" value={dias} onChange={(e) => setDias(parseInt(e.target.value) || 0)} onKeyDown={soloNum}
              style={{ ...inp, width: 40, textAlign: 'center' }} />
          </div>
        )}
        <div>
          <label style={lbl}>LISTA PRECIO</label>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setListaPrecio(n as 1 | 2 | 3)} title={`Precio ${n}`}
                style={{ width: 28, height: 28, border: listaPrecio === n ? '2px solid #7c3aed' : '1px solid #d1d5db', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: listaPrecio === n ? '#f3e8ff' : '#fff', color: listaPrecio === n ? '#7c3aed' : '#374151' }}>P{n}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#6b7280' }}>TOTAL</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: total > 0 ? '#16a34a' : '#9ca3af', lineHeight: 1 }}>{fmtMon(total)}</div>
        </div>
      </div>

      {/* Fila 2: Datos cliente */}
      <div style={{ ...card, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div>
          <label style={lbl}>CÓDIGO</label>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <input type="text" value={cliente.id ?? ''} readOnly placeholder="—"
              style={{ ...inp, width: 60, textAlign: 'center', fontWeight: 700, color: '#7c3aed', background: '#f9fafb' }} />
            <button onClick={() => setShowClienteModal(true)} title="Buscar cliente"
              style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={14} color="#7c3aed" />
            </button>
            {cliente.esCliente && (
              <button onClick={() => setCliente(CLIENTE_VACIO)} title="Quitar cliente"
                style={{ width: 28, height: 28, border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="#dc2626" />
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>CLIENTE</label>
          <input type="text" value={cliente.nombre} readOnly placeholder="Busca un cliente…"
            style={{ ...inp, width: '100%', height: 28, fontSize: 13, fontWeight: 600, background: '#f9fafb' }} />
        </div>
        <div>
          <label style={lbl}>NIT / CC</label>
          <input type="text" value={cliente.nit} readOnly style={{ ...inp, width: 110, background: '#f9fafb' }} />
        </div>
        <div>
          <label style={lbl}>TELÉFONO</label>
          <input type="text" value={cliente.tel} readOnly style={{ ...inp, width: 100, background: '#f9fafb' }} />
        </div>
        <div>
          <label style={lbl}>CUPO</label>
          <input type="text" value={cliente.cupo > 0 ? fmtMon(cliente.cupo) : '$ 0'} readOnly
            style={{ ...inp, width: 100, textAlign: 'right', fontWeight: 600, color: cliente.cupo > 0 ? '#2563eb' : '#9ca3af', background: '#f9fafb' }} />
        </div>
      </div>

      {tipo === 'Crédito' && !cliente.esCliente && (
        <div style={{ margin: '0 0 6px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
          ⚠ Selecciona un cliente real para que la deuda aparezca en Cuentas por Cobrar.
        </div>
      )}

      {/* Tabla de items */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fff', borderBottom: '3px solid #7c3aed' }}>
              <th style={{ padding: 8, textAlign: 'left', width: 100, fontSize: 11, color: '#374151', fontWeight: 700 }}>Código</th>
              <th style={{ padding: 8, textAlign: 'left', fontSize: 11, color: '#374151', fontWeight: 700 }}>Artículo</th>
              <th style={{ padding: 8, textAlign: 'center', width: 55, fontSize: 11, color: '#374151', fontWeight: 700 }}>Exist.</th>
              <th style={{ padding: 8, textAlign: 'center', width: 65, fontSize: 11, color: '#374151', fontWeight: 700 }}>Cant.</th>
              <th style={{ padding: 8, textAlign: 'right', width: 95, fontSize: 11, color: '#374151', fontWeight: 700 }}>Precio</th>
              <th style={{ padding: 8, textAlign: 'right', width: 75, fontSize: 11, color: '#374151', fontWeight: 700 }}>Desc.</th>
              <th style={{ padding: 8, textAlign: 'center', width: 40, fontSize: 11, color: '#374151', fontWeight: 700 }}>IVA</th>
              <th style={{ padding: 8, textAlign: 'right', width: 100, fontSize: 11, color: '#374151', fontWeight: 700 }}>Subtotal</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
        </table>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', width: 100, color: '#6b7280', fontSize: 11 }}>
                    {l.codigo}
                    {l.esServicio && <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>SERVICIO</span>}
                  </td>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>
                    {l.esServicio ? (
                      <input type="text" defaultValue={l.descripcionTemp || l.nombre}
                        onBlur={(e) => setLineas((prev) => prev.map((x) => (x.id === l.id ? { ...x, descripcionTemp: e.target.value.trim() || l.nombre } : x)))}
                        style={{ width: '100%', height: 26, border: '1px dashed #c4b5fd', borderRadius: 4, fontSize: 12, padding: '0 6px', background: '#faf5ff', outline: 'none', fontWeight: 500 }} />
                    ) : l.nombre}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center', width: 55, fontWeight: 600, fontSize: 11, color: l.esServicio ? '#9ca3af' : (l.existencia < l.cantidad ? '#dc2626' : '#16a34a') }}>{l.esServicio ? '—' : l.existencia}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'center', width: 65 }}>
                    <input type="text" defaultValue={String(l.cantidad)}
                      onFocus={(e) => e.target.select()} onKeyDown={soloNum}
                      onBlur={(e) => actualizarLinea(l.id, 'cantidad', parseFloat(e.target.value) || 1)}
                      style={{ width: 48, height: 24, textAlign: 'center', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 600, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', width: 95 }}>
                    <input type="text" key={`p-${l.id}-${l.precioVenta}`} defaultValue={fmtMon(l.precioVenta)}
                      onFocus={(e) => { e.target.value = String(l.precioVenta); e.target.select(); }}
                      onBlur={(e) => { const v = parseFloat(e.target.value.replace(/[$\s.]/g, '')) || 0; actualizarLinea(l.id, 'precioVenta', v); e.target.value = fmtMon(v); }}
                      onKeyDown={soloNum}
                      style={{ width: 90, height: 24, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 700, color: '#1f2937', outline: 'none' }} />
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', width: 75 }}>
                    <input type="text" defaultValue={l.descuento > 0 ? String(l.descuento) : ''} placeholder="0"
                      onFocus={(e) => e.target.select()} onKeyDown={soloNum}
                      onBlur={(e) => actualizarLinea(l.id, 'descuento', parseFloat(e.target.value) || 0)}
                      style={{ width: 60, height: 24, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, outline: 'none' }} />
                  </td>
                  <td style={{ padding: 4, textAlign: 'center', width: 40, color: '#6b7280', fontSize: 10 }}>{l.iva}%</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', width: 100, fontWeight: 700 }}>{fmtMon(subtotalLinea(l))}</td>
                  <td style={{ padding: 4, width: 30 }}>
                    <button onClick={() => eliminarLinea(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Fila de entrada */}
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fffbeb' }}>
                <td style={{ padding: '4px 8px', width: 100 }}>
                  <CodigoInput onAdd={agregarProducto} />
                </td>
                <td colSpan={8} style={{ padding: '4px 8px', position: 'relative' }}>
                  <NombreBuscador onPick={agregarProducto} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9ca3af' }}>F9: Finalizar</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ ...card, marginTop: 8, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          <b>{lineas.length}</b> producto(s) | Cant: <b>{lineas.reduce((s, l) => s + l.cantidad, 0)}</b>
        </div>
        <div>
          <label style={{ fontSize: 9, color: '#6b7280' }}>DESC. GLOBAL</label>
          <input type="text" value={descuentoGlobal || ''} placeholder="0"
            onChange={(e) => setDescuentoGlobal(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            style={{ display: 'block', height: 26, width: 80, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, padding: '0 6px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: '#6b7280' }}>NOTA</label>
          <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observación…"
            style={{ display: 'block', width: '100%', height: 26, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, padding: '0 6px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
          {descuentoGlobal > 0 && <div><span style={{ color: '#6b7280' }}>Desc:</span> <b style={{ color: '#d97706' }}>-{fmtMon(descuentoGlobal)}</b></div>}
          {totalIva > 0 && <div><span style={{ color: '#6b7280' }}>{ivaIncluido ? 'IVA incl.:' : 'IVA:'}</span> <b>{fmtMon(totalIva)}</b></div>}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{fmtMon(total)}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={nueva} style={{ height: 32, padding: '0 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Nueva
          </button>
          <button onClick={finalizar} disabled={guardando || lineas.length === 0}
            style={{ height: 32, padding: '0 16px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: lineas.length === 0 ? '#d1d5db' : esCotizacion ? '#2563eb' : '#16a34a',
              cursor: lineas.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, opacity: guardando ? 0.6 : 1 }}>
            <Save size={14} /> {esCotizacion ? 'Guardar Cotización (F9)' : 'Finalizar (F9)'}
          </button>
        </div>
      </div>

      {showClienteModal && (
        <BuscarClienteModal onSelect={seleccionarCliente} onClose={() => setShowClienteModal(false)} />
      )}

      {/* Modal de pago */}
      {showPagoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowPagoModal(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {tipoDocumento === 'electronica' ? 'Factura Electrónica' : 'Guardar Remisión'}
              </span>
              <button onClick={() => setShowPagoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ textAlign: 'center', marginBottom: 16, padding: '12px 0', background: '#f0fdf4', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>TOTAL A PAGAR</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a' }}>{fmtMon(total)}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{tipo} — {cliente.nombre}</div>
              </div>

              {tipo === 'Contado' ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>Forma de pago</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏦</div>
                    <div style={{ flex: 1 }}>
                      <select value={pagoMedioTransf} onChange={(e) => setPagoMedioTransf(parseInt(e.target.value))}
                        style={{ height: 26, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, padding: '0 4px' }}>
                        {medios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <input type="text" placeholder="$ 0" value={pagoTransferencia} autoFocus
                      onChange={(e) => setPagoTransferencia(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') (document.querySelector('[data-pago-efectivo]') as HTMLInputElement)?.focus(); }}
                      style={{ width: 130, height: 32, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 700, padding: '0 10px', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Efectivo</div>
                      {pagoTransfNum > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>Restante: {fmtMon(Math.max(total - pagoTransfNum, 0))}</div>}
                    </div>
                    <input type="text" data-pago-efectivo="true" value={pagoEfectivo}
                      placeholder={pagoTransfNum > 0 ? fmtMon(Math.max(total - pagoTransfNum, 0)) : fmtMon(total)}
                      onChange={(e) => setPagoEfectivo(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmarVenta(); }}
                      style={{ width: 130, height: 32, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 700, padding: '0 10px', outline: 'none' }} />
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>Total factura:</span><b>{fmtMon(total)}</b></div>
                    {faltaPagar > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#dc2626', fontWeight: 700, padding: '4px 8px', background: '#fef2f2', borderRadius: 6 }}><span>Falta pagar:</span><span>{fmtMon(faltaPagar)}</span></div>}
                    {cambioPago > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#2563eb', marginTop: 4, padding: '8px 10px', borderTop: '3px solid #2563eb', background: '#eff6ff', borderRadius: 8 }}><span>CAMBIO:</span><span>{fmtMon(cambioPago)}</span></div>}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>Abono inicial (opcional)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>Abono</div><div style={{ fontSize: 10, color: '#6b7280' }}>Deje en 0 si no hay abono</div></div>
                    <input type="text" placeholder="$ 0" value={pagoAbono} autoFocus
                      onChange={(e) => setPagoAbono(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ width: 130, height: 32, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 700, padding: '0 10px', outline: 'none' }} />
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>Total factura:</span><b>{fmtMon(total)}</b></div>
                    {pagoAbonoNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>Abono:</span><span style={{ color: '#16a34a', fontWeight: 600 }}>-{fmtMon(pagoAbonoNum)}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#dc2626', marginTop: 4, padding: '6px 0', borderTop: '2px solid #dc2626' }}><span>Saldo pendiente:</span><span>{fmtMon(Math.max(total - pagoAbonoNum, 0))}</span></div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowPagoModal(false)} style={{ height: 34, padding: '0 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> Cerrar</button>
              <button onClick={confirmarVenta} disabled={guardando || (tipo === 'Contado' && faltaPagar > 0)}
                style={{ height: 34, padding: '0 20px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: (tipo === 'Contado' && faltaPagar > 0) ? '#d1d5db' : '#16a34a',
                  cursor: (tipo === 'Contado' && faltaPagar > 0) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: guardando ? 0.6 : 1 }}>
                <Save size={15} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Código: Enter busca exacto ----------
function CodigoInput({ onAdd }: { onAdd: (p: ProductoApi) => void }) {
  const [v, setV] = useState('');
  return (
    <input type="text" placeholder="Código…" value={v} onChange={(e) => setV(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key !== 'Enter') return;
        const code = v.trim(); if (!code) return;
        try {
          const { data } = await api.get<{ data: ProductoApi[] }>('/productos', { params: { q: code, per_page: 5, activo: 1 } });
          const exacto = data.data.find((p) => p.codigo.toLowerCase() === code.toLowerCase()) || data.data[0];
          if (exacto) { onAdd(exacto); setV(''); } else toast.error(`Código "${code}" no encontrado`);
        } catch { toast.error('Error consultando producto'); }
      }}
      style={{ width: 85, height: 26, padding: '0 6px', border: '1px solid #7c3aed', borderRadius: 4, fontSize: 12, outline: 'none', fontWeight: 600 }} />
  );
}

// ---------- Nombre: buscador con dropdown ----------
function NombreBuscador({ onPick }: { onPick: (p: ProductoApi) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ProductoApi[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) { setRes([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<{ data: ProductoApi[] }>('/productos', { params: { q, per_page: 10, activo: 1 } });
        setRes(data.data); setOpen(true);
      } catch { /* noop */ }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <>
      <input type="text" placeholder="Buscar artículo por nombre…" value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) { onPick(res[0]); setQ(''); setRes([]); setOpen(false); } if (e.key === 'Escape') { setQ(''); setOpen(false); } }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: '60%', height: 26, padding: '0 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, outline: 'none' }} />
      {open && res.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 8, width: '60%', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 250, overflow: 'auto', zIndex: 100 }}>
          {res.map((a) => (
            <div key={a.id} onMouseDown={() => { onPick(a); setQ(''); setRes([]); setOpen(false); }}
              style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#6b7280', width: 80, flexShrink: 0, fontSize: 11 }}>{a.codigo}</span>
              <span style={{ fontWeight: 500, flex: 1 }}>{a.nombre}</span>
              <span style={{ color: toNum(a.existencia) > 0 ? '#16a34a' : '#dc2626', fontWeight: 600, width: 40, textAlign: 'right', fontSize: 11 }}>{a.es_servicio ? '—' : toNum(a.existencia)}</span>
              <span style={{ fontWeight: 700, color: '#7c3aed', width: 80, textAlign: 'right', fontSize: 11 }}>{fmtMon(a.precio_venta_1)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Modal buscar cliente ----------
function BuscarClienteModal({ onSelect, onClose }: { onSelect: (c: ClienteApi) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ClienteApi[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<{ data: ClienteApi[] }>('/clientes', { params: { q, per_page: 15, activo: 1 } });
        setRes(data.data);
      } catch { /* noop */ }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, width: 560, maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={18} color="#7c3aed" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o identificación…"
            style={{ flex: 1, height: 34, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, padding: '0 10px', outline: 'none' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {res.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin resultados</div>
          ) : res.map((c) => (
            <div key={c.id} onClick={() => onSelect(c)}
              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#f3e8ff')} onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{c.razon_social}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{c.identificacion}{c.telefono ? ` · ${c.telefono}` : ''}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>#{c.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
