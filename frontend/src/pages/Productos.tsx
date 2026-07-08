import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Package, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Field, Input, Select, Textarea,
  Modal, Table, Th, Td, EmptyState,
} from '../components/ui';

interface Producto {
  id: number;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  familia_id: number | null;
  es_servicio: boolean;
  precio_costo: string | number;
  precio_venta_1: string | number;
  iva_pct: string | number;
  existencia: string | number;
  existencia_minima: string | number;
  activo: boolean;
}

interface Familia { id: number; nombre: string }

const empty: Partial<Producto> = {
  es_servicio: false,
  iva_pct: 19,
  precio_costo: 0,
  precio_venta_1: 0,
  existencia: 0,
  existencia_minima: 0,
  activo: true,
};

const fmt = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v ?? 0)).toLocaleString('es-CO');

export function ProductosPage() {
  const [rows, setRows] = useState<Producto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'productos' | 'servicios'>('todos');
  const [editing, setEditing] = useState<Partial<Producto> | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { q: busqueda, per_page: 100 };
      if (tipoFiltro === 'servicios')  params.es_servicio = 1;
      if (tipoFiltro === 'productos')  params.es_servicio = 0;
      const [prodRes, famRes] = await Promise.all([
        api.get<{ data: Producto[] }>('/productos', { params }),
        api.get<{ familias: Familia[] }>('/familias'),
      ]);
      setRows(prodRes.data.data);
      setFamilias(famRes.data.familias);
    } catch (e) {
      showApiError(e, 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(() => cargar(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, tipoFiltro]);

  async function guardar() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/productos/${editing.id}`, editing);
        toast.success('Producto actualizado');
      } else {
        await api.post('/productos', editing);
        toast.success('Producto creado');
      }
      setEditing(null);
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(p: Producto) {
    if (!confirm(`¿Desactivar "${p.nombre}"? El histórico de ventas se conserva.`)) return;
    try {
      await api.delete(`/productos/${p.id}`);
      toast.success('Producto desactivado');
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo eliminar');
    }
  }

  const famNombre = (id: number | null) => id ? (familias.find(f => f.id === id)?.nombre ?? '—') : '—';

  return (
    <div className="p-6">
      <PageHeader
        title="Productos"
        subtitle="Catálogo de productos y servicios"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button onClick={() => setEditing({ ...empty })}>
              <Plus size={14} /> Nuevo producto
            </Button>
          </>
        }
      />

      {/* Filtros */}
      <Card className="mb-4">
        <div className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código, código de barras o nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-md p-1">
            {(['todos', 'productos', 'servicios'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTipoFiltro(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  tipoFiltro === f ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'productos' ? 'Productos' : 'Servicios'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState message="Sin productos" hint={busqueda ? 'Sin resultados' : 'Crea tu primer producto'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Familia</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Costo</Th>
                <Th className="text-right">Venta</Th>
                <Th className="text-right">IVA</Th>
                <Th className="text-right">Stock</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs">{p.codigo}</Td>
                  <Td>
                    <div className="font-medium">{p.nombre}</div>
                    {p.codigo_barras && <div className="text-[10px] text-gray-400">{p.codigo_barras}</div>}
                  </Td>
                  <Td className="text-xs text-gray-600">{famNombre(p.familia_id)}</Td>
                  <Td>
                    {p.es_servicio
                      ? <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded inline-flex items-center gap-1"><Wrench size={11}/> Servicio</span>
                      : <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-flex items-center gap-1"><Package size={11}/> Producto</span>}
                  </Td>
                  <Td className="text-right text-xs text-gray-500">{fmt(p.precio_costo)}</Td>
                  <Td className="text-right font-semibold">{fmt(p.precio_venta_1)}</Td>
                  <Td className="text-right text-xs">{Number(p.iva_pct)}%</Td>
                  <Td className="text-right text-xs">
                    {p.es_servicio
                      ? <span className="text-gray-400">—</span>
                      : <span className={Number(p.existencia) <= Number(p.existencia_minima) ? 'text-red-600 font-semibold' : ''}>
                          {Number(p.existencia).toLocaleString('es-CO')}
                        </span>}
                  </Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditing(p)}
                        title="Editar"
                        className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => eliminar(p)}
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
        title={editing?.id ? 'Editar producto' : 'Nuevo producto'}
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
          <div className="space-y-4">
            {/* Toggle producto/servicio */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditing({ ...editing, es_servicio: false })}
                className={`flex-1 h-16 rounded-lg border-2 flex items-center justify-center gap-2 transition ${
                  !editing.es_servicio ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                <Package size={20} />
                <div className="text-left">
                  <div className="font-semibold text-sm">Producto físico</div>
                  <div className="text-[10px]">Con inventario</div>
                </div>
              </button>
              <button
                onClick={() => setEditing({ ...editing, es_servicio: true })}
                className={`flex-1 h-16 rounded-lg border-2 flex items-center justify-center gap-2 transition ${
                  editing.es_servicio ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                <Wrench size={20} />
                <div className="text-left">
                  <div className="font-semibold text-sm">Servicio</div>
                  <div className="text-[10px]">Sin inventario</div>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Código" required>
                <Input
                  value={editing.codigo ?? ''}
                  onChange={(e) => setEditing({ ...editing, codigo: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Código de barras">
                <Input
                  value={editing.codigo_barras ?? ''}
                  onChange={(e) => setEditing({ ...editing, codigo_barras: e.target.value })}
                  disabled={editing.es_servicio}
                />
              </Field>
              <Field label="Nombre" required className="md:col-span-2">
                <Input
                  value={editing.nombre ?? ''}
                  onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                />
              </Field>
              <Field label="Familia" className="md:col-span-2">
                <Select
                  value={editing.familia_id ?? ''}
                  onChange={(e) => setEditing({ ...editing, familia_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">— Sin familia —</option>
                  {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </Select>
              </Field>
              <Field label="Descripción" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={editing.descripcion ?? ''}
                  onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
                />
              </Field>
            </div>

            <div className="border-t pt-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Precios (IVA incluido)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label={editing.es_servicio ? 'Costo referencial' : 'Precio costo'}>
                  <Input
                    type="number"
                    value={editing.precio_costo ?? 0}
                    onChange={(e) => setEditing({ ...editing, precio_costo: parseFloat(e.target.value) || 0 })}
                    min={0} step="0.01"
                  />
                </Field>
                <Field label="Precio venta">
                  <Input
                    type="number"
                    value={editing.precio_venta_1 ?? 0}
                    onChange={(e) => setEditing({ ...editing, precio_venta_1: parseFloat(e.target.value) || 0 })}
                    min={0} step="0.01"
                  />
                </Field>
                <Field label="IVA %">
                  <Select
                    value={editing.iva_pct ?? 19}
                    onChange={(e) => setEditing({ ...editing, iva_pct: parseFloat(e.target.value) })}
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={19}>19%</option>
                  </Select>
                </Field>
              </div>
            </div>

            {!editing.es_servicio && (
              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Inventario</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Existencia actual">
                    <Input
                      type="number"
                      value={editing.existencia ?? 0}
                      onChange={(e) => setEditing({ ...editing, existencia: parseFloat(e.target.value) || 0 })}
                      step="0.001"
                    />
                  </Field>
                  <Field label="Existencia mínima" hint="Alerta cuando baje de este valor">
                    <Input
                      type="number"
                      value={editing.existencia_minima ?? 0}
                      onChange={(e) => setEditing({ ...editing, existencia_minima: parseFloat(e.target.value) || 0 })}
                      min={0} step="0.001"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
