import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { cargarCatalogos, buscarMunicipios, calcularDv } from '../lib/catalogos';
import type { CatalogosDian, Municipio } from '../lib/catalogos';
import {
  PageHeader, Card, Button, Field, Input, Select,
  Modal, Table, Th, Td, EmptyState,
} from '../components/ui';

interface ContactoNotificacion {
  id?: number;
  tipo: 'entrega' | 'contable' | 'pagos' | 'gerencia' | 'otros';
  nombre?: string | null;
  cargo?: string | null;
  correo: string;
  telefono?: string | null;
  nota?: string | null;
}

interface Cliente {
  id: number;
  codigo: string | null;
  razon_social: string;
  tipo_persona: 'natural' | 'juridica';
  tipo_documento_id: number | null;
  identificacion: string;
  dv: string | null;
  matricula_mercantil: string | null;
  nombre_comercial: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  municipio_id: number | null;
  departamento_id: number | null;
  regimen_id: number | null;
  liability_id: number | null;
  tipo_adquirente_id: number | null;
  cupo_credito: string | number;
  dias_credito: number;
  activo: boolean;
  contactos_notificacion?: ContactoNotificacion[];
}

interface ClienteForm extends Partial<Cliente> {
  contactos?: ContactoNotificacion[];
}

const empty: ClienteForm = {
  tipo_persona: 'juridica',
  tipo_documento_id: 6,  // NIT por default
  cupo_credito: 0,
  dias_credito: 0,
  activo: true,
  contactos: [],
};

const emptyContacto: ContactoNotificacion = {
  tipo: 'entrega',
  nombre: '',
  cargo: '',
  correo: '',
  telefono: '',
  nota: '',
};

const tipoContactoLabels: Record<ContactoNotificacion['tipo'], string> = {
  entrega:  'Contacto de Entrega',
  contable: 'Contable',
  pagos:    'Pagos',
  gerencia: 'Gerencia',
  otros:    'Otro',
};

export function ClientesPage() {
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editing, setEditing] = useState<ClienteForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [catalogos, setCatalogos] = useState<CatalogosDian | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  // Cargar catálogos una sola vez
  useEffect(() => {
    cargarCatalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

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
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(() => cargar(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  async function abrirEditar(cliente: Cliente) {
    // Traer detalle con contactos
    try {
      const { data } = await api.get<{ cliente: Cliente }>(`/clientes/${cliente.id}`);
      setEditing({
        ...data.cliente,
        contactos: data.cliente.contactos_notificacion ?? [],
      });
      // Cargar municipios del departamento del cliente
      if (data.cliente.departamento_id) {
        buscarMunicipios(data.cliente.departamento_id).then(setMunicipios);
      }
    } catch (e) {
      showApiError(e, 'No se pudo cargar el cliente');
    }
  }

  function abrirNuevo() {
    setEditing({ ...empty, contactos: [] });
    setMunicipios([]);
  }

  async function onCambiaDepartamento(deptId: number | null) {
    setEditing((c) => c ? { ...c, departamento_id: deptId, municipio_id: null } : c);
    if (deptId) {
      const muni = await buscarMunicipios(deptId);
      setMunicipios(muni);
    } else {
      setMunicipios([]);
    }
  }

  function onCambiaIdentificacion(v: string) {
    setEditing((c) => c ? { ...c, identificacion: v, dv: calcularDv(v) } : c);
  }

  function addContacto() {
    setEditing((c) => c ? { ...c, contactos: [...(c.contactos ?? []), { ...emptyContacto }] } : c);
  }
  function removeContacto(i: number) {
    setEditing((c) => c ? { ...c, contactos: (c.contactos ?? []).filter((_, ix) => ix !== i) } : c);
  }
  function updateContacto(i: number, patch: Partial<ContactoNotificacion>) {
    setEditing((c) => {
      if (!c) return c;
      const arr = [...(c.contactos ?? [])];
      arr[i] = { ...arr[i], ...patch };
      return { ...c, contactos: arr };
    });
  }

  async function guardar() {
    if (!editing) return;
    setSaving(true);
    try {
      // Limpiar contactos vacíos antes de enviar
      const payload = {
        ...editing,
        contactos: (editing.contactos ?? []).filter((c) => c.correo?.trim()),
      };
      if (editing.id) {
        await api.put(`/clientes/${editing.id}`, payload);
        toast.success('Cliente actualizado');
      } else {
        await api.post('/clientes', payload);
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
    if (!confirm(`¿Desactivar "${c.razon_social}"?`)) return;
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
        subtitle="Base de datos de clientes con datos fiscales DIAN"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button onClick={abrirNuevo}>
              <Plus size={14} /> Nuevo cliente
            </Button>
          </>
        }
      />

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

      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState message="Sin clientes" hint={busqueda ? 'Sin resultados' : 'Crea tu primer cliente'} />
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
                        onClick={() => abrirEditar(c)}
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

      {/* ============ MODAL CLIENTE ============ */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              <X size={14} /> Cancelar
            </Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {editing && catalogos && (
          <div className="space-y-6">
            {/* ---------- DATOS BÁSICOS ---------- */}
            <Section title="Datos básicos">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <Field label="Nombre / Razón Social" required className="md:col-span-5">
                  <Input
                    value={editing.razon_social ?? ''}
                    onChange={(e) => setEditing({ ...editing, razon_social: e.target.value })}
                    autoFocus
                  />
                </Field>
                <Field label="NIT / CC" required className="md:col-span-3">
                  <div className="flex gap-1">
                    <Input
                      value={editing.identificacion ?? ''}
                      onChange={(e) => onCambiaIdentificacion(e.target.value.replace(/\D/g, ''))}
                    />
                    {editing.dv && (
                      <div
                        className="w-9 h-9 rounded-md bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center font-bold text-sm"
                        title="Dígito de verificación (calculado automáticamente)"
                      >
                        {editing.dv}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Tipo persona" required className="md:col-span-2">
                  <Select
                    value={editing.tipo_persona}
                    onChange={(e) => setEditing({ ...editing, tipo_persona: e.target.value as 'natural' | 'juridica' })}
                  >
                    <option value="juridica">Jurídica</option>
                    <option value="natural">Natural</option>
                  </Select>
                </Field>
                <Field label="Estado" className="md:col-span-2">
                  <Select
                    value={editing.activo ? 1 : 0}
                    onChange={(e) => setEditing({ ...editing, activo: e.target.value === '1' })}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* ---------- DATOS FISCALES DIAN ---------- */}
            <Section title="Datos fiscales (DIAN)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Tipo documento">
                  <Select
                    value={editing.tipo_documento_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, tipo_documento_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">— Seleccionar —</option>
                    {catalogos.tipos_documento.map(td => (
                      <option key={td.id} value={td.id}>{td.codigo} — {td.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tipo responsabilidad">
                  <Select
                    value={editing.liability_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, liability_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">— Seleccionar —</option>
                    {catalogos.tipos_responsabilidad.map(t => (
                      <option key={t.id} value={t.id}>{t.codigo} — {t.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Régimen tributario">
                  <Select
                    value={editing.regimen_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, regimen_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">— Seleccionar —</option>
                    {catalogos.tipos_regimen.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tipo adquirente">
                  <Select
                    value={editing.tipo_adquirente_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, tipo_adquirente_id: e.target.value ? parseInt(e.target.value) : null })}
                  >
                    <option value="">— Seleccionar —</option>
                    {catalogos.tipos_adquirente.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Departamento">
                  <Select
                    value={editing.departamento_id ?? ''}
                    onChange={(e) => onCambiaDepartamento(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">— Seleccionar —</option>
                    {catalogos.departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Municipio">
                  <Select
                    value={editing.municipio_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, municipio_id: e.target.value ? parseInt(e.target.value) : null })}
                    disabled={!editing.departamento_id || municipios.length === 0}
                  >
                    <option value="">
                      {editing.departamento_id ? 'Seleccionar municipio…' : 'Primero selecciona departamento'}
                    </option>
                    {municipios.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </Select>
                </Field>
                {editing.tipo_persona === 'juridica' && (
                  <Field label="Matrícula mercantil" className="md:col-span-3">
                    <Input
                      value={editing.matricula_mercantil ?? ''}
                      onChange={(e) => setEditing({ ...editing, matricula_mercantil: e.target.value })}
                      placeholder="Opcional"
                    />
                  </Field>
                )}
              </div>
            </Section>

            {/* ---------- CONTACTO ---------- */}
            <Section title="Contacto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <Field label="WhatsApp">
                  <Input
                    value={editing.whatsapp ?? ''}
                    onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })}
                  />
                </Field>
                <Field label="Dirección" className="md:col-span-3">
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
            </Section>

            {/* ---------- CONTACTOS DE NOTIFICACIÓN ---------- */}
            <Section
              title="Contactos de notificación"
              subtitle="Estos correos reciben copia (Cc) cuando se envía la factura por email. No aparecen en el PDF impreso."
            >
              {(editing.contactos ?? []).length === 0 ? (
                <div className="text-xs text-gray-400 mb-3">Sin contactos agregados</div>
              ) : (
                <div className="space-y-2 mb-3">
                  {(editing.contactos ?? []).map((c, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-gray-50 rounded-lg p-2">
                      <Select
                        className="md:col-span-2"
                        value={c.tipo}
                        onChange={(e) => updateContacto(i, { tipo: e.target.value as ContactoNotificacion['tipo'] })}
                      >
                        {Object.entries(tipoContactoLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </Select>
                      <Input
                        className="md:col-span-3"
                        placeholder="Nombre y cargo"
                        value={c.nombre ?? ''}
                        onChange={(e) => updateContacto(i, { nombre: e.target.value })}
                      />
                      <Input
                        className="md:col-span-3"
                        placeholder="correo@empresa.co"
                        type="email"
                        value={c.correo}
                        onChange={(e) => updateContacto(i, { correo: e.target.value })}
                      />
                      <Input
                        className="md:col-span-2"
                        placeholder="Teléfono"
                        value={c.telefono ?? ''}
                        onChange={(e) => updateContacto(i, { telefono: e.target.value })}
                      />
                      <Input
                        className="md:col-span-1"
                        placeholder="Nota"
                        value={c.nota ?? ''}
                        onChange={(e) => updateContacto(i, { nota: e.target.value })}
                      />
                      <button
                        onClick={() => removeContacto(i)}
                        title="Quitar"
                        className="md:col-span-1 w-9 h-9 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="secondary" onClick={addContacto}>
                <Plus size={14} /> Agregar contacto
              </Button>
            </Section>
          </div>
        )}
        {editing && !catalogos && (
          <div className="text-gray-400 text-center py-8">Cargando catálogos DIAN…</div>
        )}
      </Modal>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide">{title}</div>
        {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
