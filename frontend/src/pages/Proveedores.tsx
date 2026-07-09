import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, X, FileText, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { cargarCatalogos, buscarMunicipios, calcularDv } from '../lib/catalogos';
import type { CatalogosDian, Municipio } from '../lib/catalogos';
import {
  PageHeader, Card, Button, Field, Input, Select,
  Modal, Table, Th, Td, EmptyState,
} from '../components/ui';

/* ================================================================
 * Proveedores — Un solo maestro, tipo_soporte decide cómo se
 * documentan las compras:
 *   fe_recibida       → EL proveedor emite FE/POS/papel
 *   documento_soporte → YO emito DS DIAN a su nombre
 * ============================================================== */

interface ContactoNotificacion {
  id?: number;
  tipo: 'pagos' | 'contable' | 'gerencia' | 'entregas' | 'otros';
  nombre?: string | null;
  cargo?: string | null;
  correo: string;
  telefono?: string | null;
  nota?: string | null;
}

interface Proveedor {
  id: number;
  codigo: string | null;
  razon_social: string;
  nombre_comercial: string | null;
  tipo_persona: 'natural' | 'juridica';
  tipo_documento_id: number | null;
  identificacion: string;
  dv: string | null;
  matricula_mercantil: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  municipio_id: number | null;
  departamento_id: number | null;
  regimen_id: number | null;
  liability_id: number | null;
  no_obligado_facturar: boolean;
  tipo_soporte: 'fe_recibida' | 'documento_soporte';
  retencion_fuente_pct: string | number;
  retencion_iva_pct: string | number;
  retencion_ica_pct: string | number;
  concepto_dian: string | null;
  banco_nombre: string | null;
  banco_tipo_cuenta: 'ahorros' | 'corriente' | null;
  banco_numero_cuenta: string | null;
  cupo_credito: string | number;
  dias_credito: number;
  observaciones: string | null;
  activo: boolean;
  contactos_notificacion?: ContactoNotificacion[];
}

interface ProveedorForm extends Partial<Proveedor> {
  contactos?: ContactoNotificacion[];
}

const empty: ProveedorForm = {
  tipo_persona: 'juridica',
  tipo_documento_id: 6,
  tipo_soporte: 'fe_recibida',
  no_obligado_facturar: false,
  retencion_fuente_pct: 0,
  retencion_iva_pct: 0,
  retencion_ica_pct: 0,
  cupo_credito: 0,
  dias_credito: 0,
  activo: true,
  contactos: [],
};

const emptyContacto: ContactoNotificacion = {
  tipo: 'pagos',
  nombre: '',
  cargo: '',
  correo: '',
  telefono: '',
  nota: '',
};

const tipoContactoLabels: Record<ContactoNotificacion['tipo'], string> = {
  pagos:    'Pagos',
  contable: 'Contable',
  gerencia: 'Gerencia',
  entregas: 'Entregas',
  otros:    'Otro',
};

export function ProveedoresPage() {
  const [rows, setRows] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'fe_recibida' | 'documento_soporte'>('todos');
  const [editing, setEditing] = useState<ProveedorForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [catalogos, setCatalogos] = useState<CatalogosDian | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  useEffect(() => {
    cargarCatalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { q: busqueda, per_page: 100 };
      if (tipoFiltro !== 'todos') params.tipo_soporte = tipoFiltro;
      const { data } = await api.get<{ data: Proveedor[] }>('/proveedores', { params });
      setRows(data.data);
    } catch (e) {
      showApiError(e, 'Error cargando proveedores');
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

  function abrirEditar(prov: Proveedor) {
    setEditing({ ...prov, contactos: [] });
    setMunicipios([]);

    api.get<{ proveedor: Proveedor }>(`/proveedores/${prov.id}`)
      .then(({ data }) => {
        setEditing((cur) => cur && cur.id === prov.id
          ? { ...cur, contactos: data.proveedor.contactos_notificacion ?? [] }
          : cur);
      })
      .catch((e) => showApiError(e, 'No se pudieron cargar los contactos'));

    if (prov.departamento_id) {
      buscarMunicipios(prov.departamento_id).then(setMunicipios).catch(() => {});
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
      const payload = {
        ...editing,
        contactos: (editing.contactos ?? []).filter((c) => c.correo?.trim()),
      };
      if (editing.id) {
        await api.put(`/proveedores/${editing.id}`, payload);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/proveedores', payload);
        toast.success('Proveedor creado');
      }
      setEditing(null);
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(p: Proveedor) {
    if (!confirm(`¿Desactivar "${p.razon_social}"?`)) return;
    try {
      await api.delete(`/proveedores/${p.id}`);
      toast.success('Proveedor desactivado');
      await cargar();
    } catch (e) {
      showApiError(e, 'No se pudo eliminar');
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Proveedores"
        subtitle="Facturas recibidas y Documentos Soporte DIAN"
        actions={
          <>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button onClick={abrirNuevo}>
              <Plus size={14} /> Nuevo proveedor
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
              placeholder="Buscar por razón social, NIT, email o teléfono…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-md p-1">
            {[
              { k: 'todos',             label: 'Todos' },
              { k: 'fe_recibida',       label: 'FE recibidas' },
              { k: 'documento_soporte', label: 'Doc. Soporte' },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setTipoFiltro(f.k as typeof tipoFiltro)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  tipoFiltro === f.k ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f.label}
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
          <EmptyState message="Sin proveedores" hint={busqueda ? 'Sin resultados' : 'Crea tu primer proveedor'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Razón social</Th>
                <Th>NIT / CC</Th>
                <Th>Tipo</Th>
                <Th>Soporte</Th>
                <Th>Contacto</Th>
                <Th className="text-right">Cupo</Th>
                <Th>Estado</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td className="font-medium">{p.razon_social}</Td>
                  <Td className="font-mono text-xs">{p.identificacion}{p.dv ? `-${p.dv}` : ''}</Td>
                  <Td>
                    <span className={`text-xs px-2 py-0.5 rounded ${p.tipo_persona === 'juridica' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {p.tipo_persona === 'juridica' ? 'Jurídica' : 'Natural'}
                    </span>
                  </Td>
                  <Td>
                    <SoporteBadge tipo={p.tipo_soporte} />
                  </Td>
                  <Td className="text-xs text-gray-600">
                    {p.email && <div>{p.email}</div>}
                    {p.telefono && <div className="text-gray-500">{p.telefono}</div>}
                  </Td>
                  <Td className="text-right text-xs">
                    {Number(p.cupo_credito) > 0
                      ? `$ ${Number(p.cupo_credito).toLocaleString('es-CO')} · ${p.dias_credito}d`
                      : <span className="text-gray-400">—</span>}
                  </Td>
                  <Td>
                    {p.activo
                      ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Activo</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactivo</span>}
                  </Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => abrirEditar(p)}
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

      {/* ============ MODAL PROVEEDOR ============ */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
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
          <div className="space-y-3">
            {/* ---------- SOPORTE (decisión de la cuenta) ---------- */}
            <div className="grid grid-cols-2 gap-2">
              <SoporteCard
                active={editing.tipo_soporte === 'fe_recibida'}
                title="Factura Electrónica recibida"
                desc="El proveedor emite su FE/POS y tú la registras en Facturas Recibidas."
                Icon={FileText}
                onClick={() => setEditing({ ...editing, tipo_soporte: 'fe_recibida' })}
              />
              <SoporteCard
                active={editing.tipo_soporte === 'documento_soporte'}
                title="Documento Soporte"
                desc="Tú emites DS DIAN a nombre del proveedor (no obligado a facturar)."
                Icon={Receipt}
                onClick={() => setEditing({ ...editing, tipo_soporte: 'documento_soporte', no_obligado_facturar: true })}
              />
            </div>

            {/* ---------- DATOS BÁSICOS ---------- */}
            <Section title="Datos básicos">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
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
                        className="w-8 h-8 rounded-md bg-primary-50 text-primary-700 border border-primary-200 flex items-center justify-center font-bold text-xs"
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
                <Field label="Nombre comercial" className="md:col-span-6">
                  <Input
                    value={editing.nombre_comercial ?? ''}
                    onChange={(e) => setEditing({ ...editing, nombre_comercial: e.target.value })}
                    placeholder="Opcional"
                  />
                </Field>
                <Field label="Código interno" className="md:col-span-3">
                  <Input
                    value={editing.codigo ?? ''}
                    onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                    placeholder="Opcional"
                  />
                </Field>
                <Field label="Matrícula mercantil" className="md:col-span-3">
                  <Input
                    value={editing.matricula_mercantil ?? ''}
                    onChange={(e) => setEditing({ ...editing, matricula_mercantil: e.target.value })}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            </Section>

            {/* ---------- DATOS FISCALES DIAN ---------- */}
            <Section title="Datos fiscales (DIAN)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                <Field label="No obligado a facturar" hint="Si es persona/empresa sin obligación DIAN">
                  <div className="h-8 flex items-center">
                    <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!editing.no_obligado_facturar}
                        onChange={(e) => setEditing({ ...editing, no_obligado_facturar: e.target.checked })}
                        className="w-4 h-4 accent-primary-600"
                      />
                      <span className="text-gray-700">Marcar como no obligado</span>
                    </label>
                  </div>
                </Field>
              </div>
            </Section>

            {/* ---------- RETENCIONES (aparece con más énfasis si es DS) ---------- */}
            <Section
              title={editing.tipo_soporte === 'documento_soporte' ? 'Retenciones aplicables al DS' : 'Retenciones aplicables'}
              subtitle={editing.tipo_soporte === 'documento_soporte'
                ? 'Se calculan al momento de emitir el Documento Soporte y se descuentan del pago.'
                : 'Opcionales — solo si eres agente de retención.'}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Field label="Ret. Fuente %">
                  <Input
                    type="number"
                    value={Number(editing.retencion_fuente_pct ?? 0)}
                    onChange={(e) => setEditing({ ...editing, retencion_fuente_pct: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step="0.01"
                  />
                </Field>
                <Field label="Ret. IVA %">
                  <Input
                    type="number"
                    value={Number(editing.retencion_iva_pct ?? 0)}
                    onChange={(e) => setEditing({ ...editing, retencion_iva_pct: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step="0.01"
                  />
                </Field>
                <Field label="Ret. ICA %">
                  <Input
                    type="number"
                    value={Number(editing.retencion_ica_pct ?? 0)}
                    onChange={(e) => setEditing({ ...editing, retencion_ica_pct: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step="0.01"
                  />
                </Field>
                <Field label="Concepto DIAN">
                  <Input
                    value={editing.concepto_dian ?? ''}
                    onChange={(e) => setEditing({ ...editing, concepto_dian: e.target.value })}
                    placeholder="Ej. Honorarios, Servicios"
                  />
                </Field>
              </div>
            </Section>

            {/* ---------- CONTACTO ---------- */}
            <Section title="Contacto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                    value={Number(editing.cupo_credito ?? 0)}
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

            {/* ---------- CUENTA BANCARIA ---------- */}
            <Section title="Cuenta bancaria" subtitle="Para transferencias / consignaciones.">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <Field label="Banco" className="md:col-span-3">
                  <Input
                    value={editing.banco_nombre ?? ''}
                    onChange={(e) => setEditing({ ...editing, banco_nombre: e.target.value })}
                    placeholder="Ej. Bancolombia"
                  />
                </Field>
                <Field label="Tipo cuenta" className="md:col-span-1">
                  <Select
                    value={editing.banco_tipo_cuenta ?? ''}
                    onChange={(e) => setEditing({ ...editing, banco_tipo_cuenta: (e.target.value || null) as 'ahorros' | 'corriente' | null })}
                  >
                    <option value="">—</option>
                    <option value="ahorros">Ahorros</option>
                    <option value="corriente">Corriente</option>
                  </Select>
                </Field>
                <Field label="Número de cuenta" className="md:col-span-2">
                  <Input
                    value={editing.banco_numero_cuenta ?? ''}
                    onChange={(e) => setEditing({ ...editing, banco_numero_cuenta: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            {/* ---------- CONTACTOS DE NOTIFICACIÓN ---------- */}
            <Section
              title="Contactos de notificación"
              subtitle="Estos correos reciben copia (Cc) al enviar el comprobante de pago o el DS emitido."
            >
              {(editing.contactos ?? []).length === 0 ? (
                <div className="text-xs text-gray-400 mb-2">Sin contactos agregados</div>
              ) : (
                <div className="space-y-1.5 mb-2">
                  {(editing.contactos ?? []).map((c, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center bg-gray-50 rounded-md p-1.5">
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
                        className="md:col-span-1 w-8 h-8 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="secondary" onClick={addContacto}>
                <Plus size={14} /> Agregar contacto
              </Button>
            </Section>

            <Field label="Observaciones">
              <textarea
                rows={2}
                value={editing.observaciones ?? ''}
                onChange={(e) => setEditing({ ...editing, observaciones: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </Field>
          </div>
        )}
        {editing && !catalogos && (
          <div className="text-gray-400 text-center py-8">Cargando catálogos DIAN…</div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- badges + subcomponentes ---------- */

function SoporteBadge({ tipo }: { tipo: Proveedor['tipo_soporte'] }) {
  if (tipo === 'documento_soporte') {
    return (
      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
        <Receipt size={11} /> Doc. Soporte
      </span>
    );
  }
  return (
    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
      <FileText size={11} /> FE recibida
    </span>
  );
}

function SoporteCard({
  active, title, desc, Icon, onClick,
}: {
  active: boolean; title: string; desc: string;
  Icon: typeof FileText; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border-2 text-left transition ${
        active ? 'border-primary-500 bg-primary-50/60 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className={`flex items-center gap-2 text-sm font-bold ${active ? 'text-primary-700' : 'text-gray-700'}`}>
        <Icon size={16} /> {title}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{desc}</div>
    </button>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <div className="w-1 h-3.5 bg-primary-500 rounded-sm" />
        <div className="text-[11px] font-bold text-primary-700 uppercase tracking-widest">{title}</div>
      </div>
      {subtitle && <div className="text-[10px] text-gray-500 -mt-1 mb-2 ml-2.5 leading-tight">{subtitle}</div>}
      {children}
    </div>
  );
}
