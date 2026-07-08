import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Package, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Table, Th, Td, EmptyState,
} from '../components/ui';
import { ProductoModal, type ProductoForm } from './ProductoModal';

/* ================================================================
 * Modelo de BD (backend Laravel) vs modelo del form:
 *   - BD tiene snake_case (precio_costo, precio_venta_1, iva_pct…)
 *   - El modal usa nombres del desktop (Precio_Costo, Precio_Venta…)
 *   Se convierten en toForm() / toApi() — así el ProductoModal es un
 *   port 1:1 del desktop y no hay que renombrar campos por dentro.
 * ============================================================== */

interface Producto {
  id: number;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  familia_id: number | null;
  etiqueta: string | null;
  es_servicio: boolean;
  precio_costo: string | number;
  precio_venta_1: string | number;
  precio_venta_2: string | number;
  precio_venta_3: string | number;
  precio_minimo: string | number;
  iva_pct: string | number;
  existencia: string | number;
  existencia_minima: string | number;
  ubicacion: string | null;
  proveedor_id: number | null;
  activo: boolean;
}

interface Familia { id: number; nombre: string }

/* Etiquetas hardcodeadas por ahora — cuando se implemente CRUD de etiquetas
   se cambia por endpoint. Se guardan como string en productos.etiqueta.
   El modal usa Id_Etiqueta numérico, así que mapeamos por índice+1. */
const ETIQUETAS = [
  { id: 1, nombre: 'Nuevo' },
  { id: 2, nombre: 'Oferta' },
  { id: 3, nombre: 'Destacado' },
  { id: 4, nombre: 'Descontinuado' },
];

function toForm(p: Producto | null): ProductoForm {
  if (!p) return formVacio();
  return {
    Items: p.id,
    Codigo: p.codigo ?? '',
    Nombres_Articulo: p.nombre ?? '',
    Precio_Costo:  Number(p.precio_costo)  || 0,
    Precio_Venta:  Number(p.precio_venta_1) || 0,
    Precio_Venta2: Number(p.precio_venta_2) || 0,
    Precio_Venta3: Number(p.precio_venta_3) || 0,
    Precio_Minimo: Number(p.precio_minimo)  || 0,
    Iva: Number(p.iva_pct) || 0,
    Existencia: Number(p.existencia) || 0,
    Existencia_minima: Number(p.existencia_minima) || 0,
    Id_Categoria: p.familia_id ?? 0,
    CodigoPro: p.proveedor_id ?? 0,
    Estante: p.ubicacion ?? '',
    Estado: p.activo ? 1 : 0,
    Servicio: p.es_servicio ? 1 : 0,
    Id_Etiqueta: ETIQUETAS.find((et) => et.nombre === p.etiqueta)?.id ?? 0,
  };
}

function formVacio(): ProductoForm {
  return {
    Items: 0, Codigo: '', Nombres_Articulo: '',
    Precio_Costo: 0, Precio_Venta: 0, Precio_Venta2: 0, Precio_Venta3: 0,
    Precio_Minimo: 0, Iva: 19, Existencia: 0, Existencia_minima: 0,
    Id_Categoria: 0, CodigoPro: 0, Estante: '', Estado: 1, Servicio: 0, Id_Etiqueta: 0,
  };
}

function toApi(f: ProductoForm) {
  return {
    codigo: f.Codigo,
    nombre: f.Nombres_Articulo,
    familia_id: f.Id_Categoria || null,
    proveedor_id: f.CodigoPro || null,
    etiqueta: ETIQUETAS.find((et) => et.id === f.Id_Etiqueta)?.nombre ?? null,
    es_servicio: f.Servicio === 1,
    precio_costo: f.Precio_Costo,
    precio_venta_1: f.Precio_Venta,
    precio_venta_2: f.Precio_Venta2,
    precio_venta_3: f.Precio_Venta3,
    precio_minimo: f.Precio_Minimo,
    iva_pct: f.Iva,
    existencia: f.Existencia,
    existencia_minima: f.Existencia_minima,
    ubicacion: f.Estante || null,
    activo: f.Estado === 1,
  };
}

const fmt = (v: number | string | null | undefined) =>
  '$ ' + Math.round(Number(v ?? 0)).toLocaleString('es-CO');

export function ProductosPage() {
  const [rows, setRows] = useState<Producto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'productos' | 'servicios'>('todos');
  const [editing, setEditing] = useState<{ form: ProductoForm; esNuevo: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { q: busqueda, per_page: 100 };
      if (tipoFiltro === 'servicios') params.es_servicio = 1;
      if (tipoFiltro === 'productos') params.es_servicio = 0;
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
    const { form, esNuevo } = editing;
    if (!form.Codigo || !form.Nombres_Articulo) {
      toast.error('Código y descripción son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = toApi(form);
      if (esNuevo) {
        await api.post('/productos', payload);
        toast.success('Producto creado');
      } else {
        await api.put(`/productos/${form.Items}`, payload);
        toast.success('Producto actualizado');
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

  const famNombre = (id: number | null) =>
    id ? (familias.find((f) => f.id === id)?.nombre ?? '—') : '—';

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
            <Button onClick={() => setEditing({ form: formVacio(), esNuevo: true })}>
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
                <Th>Categoría</Th>
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
                        onClick={() => setEditing({ form: toForm(p), esNuevo: false })}
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

      {editing && (
        <ProductoModal
          isOpen
          onClose={() => setEditing(null)}
          form={editing.form}
          onChange={(f) => setEditing({ ...editing, form: f })}
          onSave={guardar}
          saving={saving}
          categorias={familias.map((f) => ({ id: f.id, nombre: f.nombre }))}
          proveedores={[]}
          etiquetas={ETIQUETAS}
          esNuevo={editing.esNuevo}
        />
      )}
    </div>
  );
}
