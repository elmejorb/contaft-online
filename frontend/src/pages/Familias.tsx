import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Field, Input, Select,
  Modal, Table, Th, Td, EmptyState,
} from '../components/ui';

interface Familia {
  id: number;
  codigo: string | null;
  nombre: string;
  padre_id: number | null;
  orden: number;
  activo: boolean;
}

const empty: Partial<Familia> = { orden: 0, activo: true };

export function FamiliasPage() {
  const [rows, setRows] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Familia> | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get<{ familias: Familia[] }>('/familias');
      setRows(data.familias);
    } catch (e) {
      showApiError(e, 'Error cargando familias');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/familias/${editing.id}`, editing);
        toast.success('Familia actualizada');
      } else {
        await api.post('/familias', editing);
        toast.success('Familia creada');
      }
      setEditing(null);
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(f: Familia) {
    if (!confirm(`¿Desactivar familia "${f.nombre}"?`)) return;
    try {
      await api.delete(`/familias/${f.id}`);
      toast.success('Familia desactivada');
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo eliminar');
    }
  }

  const nombrePadre = (id: number | null) => id ? (rows.find(r => r.id === id)?.nombre ?? '—') : '—';

  return (
    <div className="p-6">
      <PageHeader
        title="Familias de productos"
        subtitle="Categorías para organizar el catálogo"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button onClick={() => setEditing({ ...empty })}>
              <Plus size={14} /> Nueva familia
            </Button>
          </>
        }
      />

      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            message="Sin familias"
            hint="Crea tu primera categoría para organizar productos"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Familia padre</Th>
                <Th className="text-right">Orden</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs">{f.codigo ?? '—'}</Td>
                  <Td className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderTree size={13} className="text-primary-500" />
                      {f.nombre}
                    </span>
                  </Td>
                  <Td className="text-xs text-gray-600">{nombrePadre(f.padre_id)}</Td>
                  <Td className="text-right text-xs">{f.orden}</Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditing(f)}
                        title="Editar"
                        className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => eliminar(f)}
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

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar familia' : 'Nueva familia'}
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
            <Field label="Nombre" required>
              <Input
                value={editing.nombre ?? ''}
                onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Código interno">
              <Input
                value={editing.codigo ?? ''}
                onChange={(e) => setEditing({ ...editing, codigo: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Familia padre" hint="Opcional — para crear subcategorías">
              <Select
                value={editing.padre_id ?? ''}
                onChange={(e) => setEditing({ ...editing, padre_id: e.target.value ? parseInt(e.target.value) : null })}
              >
                <option value="">— Ninguna (raíz) —</option>
                {rows
                  .filter(r => r.id !== editing.id) // no permitir auto-referencia
                  .map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </Select>
            </Field>
            <Field label="Orden">
              <Input
                type="number"
                value={editing.orden ?? 0}
                onChange={(e) => setEditing({ ...editing, orden: parseInt(e.target.value) || 0 })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
