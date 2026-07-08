import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Field, Input, Select,
  Modal, Table, Th, Td, EmptyState,
} from '../components/ui';

interface Cliente {
  id: number;
  codigo: string | null;
  razon_social: string;
  tipo_persona: 'natural' | 'juridica';
  identificacion: string;
  dv: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  cupo_credito: string | number;
  dias_credito: number;
  activo: boolean;
}

const empty: Partial<Cliente> = {
  tipo_persona: 'natural',
  cupo_credito: 0,
  dias_credito: 0,
  activo: true,
};

export function ClientesPage() {
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editing, setEditing] = useState<Partial<Cliente> | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Cliente[] }>('/clientes', {
        params: { q: busqueda, per_page: 100 },
      });
      setRows(data.data);
    } catch (e) {
      showApiError(e, 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  // Debounce simple para búsqueda
  useEffect(() => {
    const t = setTimeout(() => cargar(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  async function guardar() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/clientes/${editing.id}`, editing);
        toast.success('Cliente actualizado');
      } else {
        await api.post('/clientes', editing);
        toast.success('Cliente creado');
      }
      setEditing(null);
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(c: Cliente) {
    if (!confirm(`¿Desactivar cliente "${c.razon_social}"?`)) return;
    try {
      await api.delete(`/clientes/${c.id}`);
      toast.success('Cliente desactivado');
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo eliminar');
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Clientes"
        subtitle="Base de datos de clientes de la empresa"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button onClick={() => setEditing({ ...empty })}>
              <Plus size={14} /> Nuevo cliente
            </Button>
          </>
        }
      />

      {/* Barra de búsqueda */}
      <Card className="mb-4">
        <div className="p-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por razón social, NIT/CC, email o teléfono…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            message="Sin clientes"
            hint={busqueda ? 'Sin resultados para esta búsqueda' : 'Crea tu primer cliente'}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Razón social</Th>
                <Th>NIT / CC</Th>
                <Th>Tipo</Th>
                <Th>Contacto</Th>
                <Th className="text-right">Cupo</Th>
                <Th>Estado</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td className="font-medium">{c.razon_social}</Td>
                  <Td className="font-mono text-xs">{c.identificacion}{c.dv ? `-${c.dv}` : ''}</Td>
                  <Td>
                    <span className={`text-xs px-2 py-0.5 rounded ${c.tipo_persona === 'juridica' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.tipo_persona === 'juridica' ? 'Jurídica' : 'Natural'}
                    </span>
                  </Td>
                  <Td className="text-xs text-gray-600">
                    {c.email && <div>{c.email}</div>}
                    {c.telefono && <div className="text-gray-500">{c.telefono}</div>}
                  </Td>
                  <Td className="text-right text-xs">
                    {Number(c.cupo_credito) > 0
                      ? `$ ${Number(c.cupo_credito).toLocaleString('es-CO')} · ${c.dias_credito}d`
                      : <span className="text-gray-400">—</span>}
                  </Td>
                  <Td>
                    {c.activo
                      ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Activo</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactivo</span>}
                  </Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditing(c)}
                        title="Editar"
                        className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => eliminar(c)}
                        title="Desactivar"
                        className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Modal crear/editar */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar cliente' : 'Nuevo cliente'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Razón social / Nombre" required className="md:col-span-2">
              <Input
                value={editing.razon_social ?? ''}
                onChange={(e) => setEditing({ ...editing, razon_social: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Tipo de persona" required>
              <Select
                value={editing.tipo_persona ?? 'natural'}
                onChange={(e) => setEditing({ ...editing, tipo_persona: e.target.value as 'natural' | 'juridica' })}
              >
                <option value="natural">Natural</option>
                <option value="juridica">Jurídica</option>
              </Select>
            </Field>
            <Field label="Código interno" hint="Opcional">
              <Input
                value={editing.codigo ?? ''}
                onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
              />
            </Field>
            <Field label="Identificación (NIT/CC)" required>
              <Input
                value={editing.identificacion ?? ''}
                onChange={(e) => setEditing({ ...editing, identificacion: e.target.value })}
              />
            </Field>
            <Field label="DV">
              <Input
                value={editing.dv ?? ''}
                onChange={(e) => setEditing({ ...editing, dv: e.target.value })}
                maxLength={2}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={editing.email ?? ''}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={editing.telefono ?? ''}
                onChange={(e) => setEditing({ ...editing, telefono: e.target.value })}
              />
            </Field>
            <Field label="Dirección" className="md:col-span-2">
              <Input
                value={editing.direccion ?? ''}
                onChange={(e) => setEditing({ ...editing, direccion: e.target.value })}
              />
            </Field>
            <Field label="Cupo de crédito">
              <Input
                type="number"
                value={editing.cupo_credito ?? 0}
                onChange={(e) => setEditing({ ...editing, cupo_credito: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </Field>
            <Field label="Días de plazo">
              <Input
                type="number"
                value={editing.dias_credito ?? 0}
                onChange={(e) => setEditing({ ...editing, dias_credito: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
