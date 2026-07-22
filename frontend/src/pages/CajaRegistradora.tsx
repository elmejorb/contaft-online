import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, LockOpen, Lock, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { PageHeader, Card, Button, Field, Input, Select } from '../components/ui';

/* CajaRegistradora — abrir / estado (cuadre en vivo) / cerrar. */

interface Caja { id: number; nombre: string; tipo: string; activa: boolean }
interface Cuadre {
  ventas_contado_efectivo: string | number; ventas_contado_transf: string | number;
  ventas_credito: string | number; pagos_efectivo: string | number; pagos_transf: string | number;
  egresos: string | number; anulaciones: string | number; retiros_parciales: string | number;
  total_efectivo_sistema: string | number;
}
interface Sesion {
  id: number; caja_id: number; base_inicial: string | number; fecha_apertura: string;
  caja?: Caja; cuadre: Cuadre;
}

const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
const money = (v: string | number | null | undefined) => '$ ' + Math.round(num(v)).toLocaleString('es-CO');

export function CajaRegistradoraPage() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  // apertura
  const [cajaId, setCajaId] = useState<number | 0>(0);
  const [base, setBase] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  // cierre
  const [conteo, setConteo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cj, ses] = await Promise.all([
        api.get<{ cajas: Caja[] }>('/cajas', { params: { activa: 1 } }),
        api.get<{ sesion: Sesion | null }>('/caja-sesion/actual'),
      ]);
      const pv = cj.data.cajas.filter((c) => c.tipo === 'punto_venta');
      setCajas(pv);
      setSesion(ses.data.sesion);
      if (pv[0] && !cajaId) setCajaId(pv[0].id);
    } catch (e) { showApiError(e, 'Error cargando caja'); }
    finally { setLoading(false); }
  }, [cajaId]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrir() {
    if (!cajaId) return toast.error('Selecciona una caja');
    setAbriendo(true);
    try {
      const { data } = await api.post<{ sesion: Sesion }>('/caja-sesion/abrir', { caja_id: cajaId, base_inicial: num(base) });
      setSesion(data.sesion); setBase('');
      toast.success('Caja abierta');
    } catch (e) { showApiError(e, 'No se pudo abrir la caja'); }
    finally { setAbriendo(false); }
  }

  async function cerrar() {
    if (!sesion) return;
    if (conteo === '') return toast.error('Ingresa el conteo físico de efectivo');
    if (!confirm('¿Cerrar la caja? No podrás registrar más ventas de contado hasta abrir de nuevo.')) return;
    setCerrando(true);
    try {
      const { data } = await api.post<{ sesion: { diferencia_final: string } }>(`/caja-sesion/${sesion.id}/cerrar`, {
        conteo: num(conteo), observacion: observacion || null,
      });
      const dif = num(data.sesion.diferencia_final);
      toast.success(dif === 0 ? 'Caja cerrada — cuadra exacto ✓' : `Caja cerrada — diferencia ${money(dif)}`, { duration: 7000 });
      setSesion(null); setConteo(''); setObservacion('');
    } catch (e) { showApiError(e, 'No se pudo cerrar'); }
    finally { setCerrando(false); }
  }

  const totalSistema = num(sesion?.cuadre.total_efectivo_sistema);
  const diferencia = useMemo(() => (conteo === '' ? null : num(conteo) - totalSistema), [conteo, totalSistema]);

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Caja" subtitle="Apertura, estado y cierre de caja"
        actions={<Button variant="secondary" onClick={cargar}><RefreshCw size={14} /> Refrescar</Button>} />

      {!sesion ? (
        /* ---------- Sin sesión: abrir ---------- */
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <Wallet size={20} className="text-primary-600" />
            <span className="font-semibold">No hay una caja abierta</span>
          </div>
          {cajas.length === 0 ? (
            <div className="text-sm text-gray-500">No tienes cajas punto de venta. Crea una en Configuración → Cajas.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Caja">
                <Select value={cajaId} onChange={(e) => setCajaId(parseInt(e.target.value) || 0)}>
                  {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </Field>
              <Field label="Base inicial (efectivo)">
                <Input type="number" min={0} value={base} onChange={(e) => setBase(e.target.value)} placeholder="0" />
              </Field>
              <div className="sm:col-span-2">
                <Button onClick={abrir} disabled={abriendo}><LockOpen size={14} /> {abriendo ? 'Abriendo…' : 'Abrir caja'}</Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* ---------- Con sesión: cuadre + cierre ---------- */
        <>
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-emerald-800">{sesion.caja?.nombre} · abierta</div>
              <div className="text-xs text-emerald-700">desde {new Date(sesion.fecha_apertura).toLocaleString('es-CO')}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-emerald-700 uppercase">Efectivo esperado</div>
              <div className="text-2xl font-extrabold text-emerald-800">{money(totalSistema)}</div>
            </div>
          </div>

          <Card className="p-5 mb-4">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Resumen de la sesión</div>
            <div className="text-sm divide-y divide-gray-100">
              <Linea label="Base inicial" v={sesion.base_inicial} />
              <Linea label="(+) Ventas contado efectivo" v={sesion.cuadre.ventas_contado_efectivo} />
              <Linea label="(+) Pagos recibidos (efectivo)" v={sesion.cuadre.pagos_efectivo} />
              <Linea label="(−) Egresos / gastos" v={sesion.cuadre.egresos} neg />
              <Linea label="(−) Anulaciones (efectivo)" v={sesion.cuadre.anulaciones} neg />
              <Linea label="(−) Retiros parciales" v={sesion.cuadre.retiros_parciales} neg />
              <div className="flex justify-between py-2 font-bold text-gray-800">
                <span>= Efectivo esperado en caja</span><span>{money(totalSistema)}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500 border-t pt-3">
              <div className="flex justify-between"><span>Ventas contado transfer.</span><span>{money(sesion.cuadre.ventas_contado_transf)}</span></div>
              <div className="flex justify-between"><span>Ventas a crédito</span><span>{money(sesion.cuadre.ventas_credito)}</span></div>
              <div className="flex justify-between"><span>Pagos (transfer.)</span><span>{money(sesion.cuadre.pagos_transf)}</span></div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Cierre / arqueo</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Conteo físico de efectivo" hint="Cuánto efectivo hay realmente en la caja">
                <Input type="number" min={0} value={conteo} onChange={(e) => setConteo(e.target.value)} placeholder="0" autoFocus />
              </Field>
              <Field label="Diferencia">
                <div className={`h-8 flex items-center px-2.5 rounded-md text-sm font-bold ${
                  diferencia === null ? 'bg-gray-50 text-gray-400'
                  : diferencia === 0 ? 'bg-emerald-50 text-emerald-700'
                  : diferencia > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                  {diferencia === null ? '—' : `${money(diferencia)} ${diferencia === 0 ? '(cuadra)' : diferencia > 0 ? '(sobrante)' : '(faltante)'}`}
                </div>
              </Field>
            </div>
            <Field label="Observación" className="mt-2">
              <Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" />
            </Field>
            <div className="mt-4 flex justify-end">
              <Button variant="danger" onClick={cerrar} disabled={cerrando}><Lock size={14} /> {cerrando ? 'Cerrando…' : 'Cerrar caja'}</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Linea({ label, v, neg }: { label: string; v: string | number; neg?: boolean }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-gray-600">{label}</span>
      <span className={neg ? 'text-red-600' : 'text-gray-800'}>{money(v)}</span>
    </div>
  );
}
