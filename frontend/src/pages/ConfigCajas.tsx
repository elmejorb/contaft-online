import { useEffect, useState } from 'react';
import { Plus, Pencil, Power, RefreshCw, Monitor, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { PageHeader, Card, Button, Field, Input, Select, Modal, EmptyState } from '../components/ui';

/* Configuración de cajas registradoras (Subfase 1 del módulo Caja). */

interface Caja {
  id: number;
  nombre: string;
  tipo: 'punto_venta' | 'principal';
  usuario_id: number | null;
  saldo: string | number;
  activa: boolean;
}
type Form = { id?: number; nombre: string; tipo: Caja['tipo']; activa: boolean };

const empty: Form = { nombre: '', tipo: 'punto_venta', activa: true };
const money = (v: string | number) => '$ ' + Math.round(Number(v ?? 0)).toLocaleString('es-CO');

export function ConfigCajasPage() {
  const [rows, setRows] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get<{ cajas: Caja[] }>('/cajas');
      setRows(data.cajas);
    } catch (e) { showApiError(e, 'Error cargando cajas'); }
    finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!editing) return;
    if (!editing.nombre.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    try {
      const payload = { nombre: editing.nombre, tipo: editing.tipo, activa: editing.activa };
      if (editing.id) await api.put(`/cajas/${editing.id}`, payload);
      else await api.post('/cajas', payload);
      toast.success('Caja guardada');
      setEditing(null);
      cargar();
    } catch (e) { showApiError(e, 'No se pudo guardar'); }
    finally { setSaving(false); }
  }

  async function desactivar(c: Caja) {
    if (!confirm(`¿Desactivar la caja "${c.nombre}"?`)) return;
    try {
      await api.delete(`/cajas/${c.id}`);
      toast.success('Caja desactivada');
      cargar();
    } catch (e) { showApiError(e, 'No se pudo desactivar'); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Cajas"
        subtitle="Registradoras del punto de venta y caja principal"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}><RefreshCw size={14} /> Refrescar</Button>
            <Button onClick={() => setEditing({ ...empty })}><Plus size={14} /> Nueva caja</Button>
          </>
        }
      />

      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState message="Sin cajas" hint="Crea una caja punto de venta para empezar" />
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((c) => {
              const principal = c.tipo === 'principal';
              const Icon = principal ? Landmark : Monitor;
              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${c.activa ? '' : 'opacity-50'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${principal ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{c.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {principal ? 'Caja principal (administrativa)' : 'Punto de venta'}
                      {!c.activa && ' · inactiva'}
                    </div>
                  </div>
                  {principal && <div className="text-sm font-semibold text-amber-700 mr-2">{money(c.saldo)}</div>}
                  <button onClick={() => setEditing({ id: c.id, nombre: c.nombre, tipo: c.tipo, activa: c.activa })}
                    className="text-gray-400 hover:text-primary-600 p-1.5" title="Editar"><Pencil size={15} /></button>
                  {c.activa && (
                    <button onClick={() => desactivar(c)} className="text-gray-400 hover:text-red-600 p-1.5" title="Desactivar"><Power size={15} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="text-xs text-gray-500 mt-3">
        La <b>caja principal</b> es administrativa (recibe traslados y depósitos); solo puede haber una.
        Las <b>punto de venta</b> son las que se abren/cierran con cada turno.
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar caja' : 'Nueva caja'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="Nombre" required>
              <Input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} placeholder="Caja 1" autoFocus />
            </Field>
            <Field label="Tipo" hint="Punto de venta = operativa (con turnos). Principal = administrativa.">
              <Select value={editing.tipo} onChange={(e) => setEditing({ ...editing, tipo: e.target.value as Caja['tipo'] })}>
                <option value="punto_venta">Punto de venta</option>
                <option value="principal">Principal (administrativa)</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={editing.activa} onChange={(e) => setEditing({ ...editing, activa: e.target.checked })} />
              Activa
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
