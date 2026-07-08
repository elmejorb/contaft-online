import { useEffect, useState } from 'react';
import { Save, Building2, FileText, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Card, Button, Field, Input, Select, Toggle } from '../components/ui';

/**
 * Datos operativos de la empresa activa. Combina la info del landlord
 * (razón social, NIT, email) — read-only aquí, se edita en otra pantalla
 * más adelante — con la config del tenant (`empresa_config`) que sí es
 * editable: IVA incluido, resolución FE, prefijo, representante legal.
 */

interface Config {
  id?: number;
  empresa_id: number;
  iva_incluido: boolean;
  resolucion_fe: string | null;
  resolucion_fecha: string | null;
  prefijo_fe: string | null;
  rango_desde: number | null;
  rango_hasta: number | null;
  iniciar_factura_en: number;
  moneda: string;
  agente_retenedor: boolean;
  autorizar_devoluciones: boolean;
  autorizar_anulaciones: boolean;
  permitir_facturar_negativo: boolean;
  usar_familias: boolean;
  usar_lotes: boolean;
  imprimir_cotizacion: boolean;
  logo_path: string | null;
  representante_tipo_doc_id: number | null;
  representante_numero: string | null;
  representante_dv: string | null;
  representante_primer_nombre: string | null;
  representante_segundo_nombre: string | null;
  representante_primer_apellido: string | null;
  representante_segundo_apellido: string | null;
  representante_cargo: string;
  representante_area: string;
}

export function DatosEmpresaPage() {
  const { empresaActiva } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ config: Config }>('/empresa-config')
      .then((r) => setConfig(r.data.config))
      .catch((e) => showApiError(e, 'Error cargando configuración'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((c) => c ? { ...c, [key]: value } : c);
  }

  async function guardar() {
    if (!config) return;
    setSaving(true);
    try {
      const { data } = await api.put<{ config: Config }>('/empresa-config', config);
      setConfig(data.config);
      toast.success('Datos guardados');
    } catch (e) {
      showApiError(e, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config || !empresaActiva) {
    return <div className="p-6 text-gray-400">Cargando…</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Datos de la Empresa"
        subtitle="Información fiscal y configuración operativa"
        actions={
          <Button onClick={guardar} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      />

      {/* === Datos generales (readonly desde landlord) === */}
      <Card className="p-5 mb-4">
        <SectionTitle icon={Building2} label="Empresa" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Razón social">
            <Input value={empresaActiva.razon_social} disabled />
          </Field>
          <Field label="NIT">
            <Input value={empresaActiva.nit} disabled />
          </Field>
          <Field label="Plan actual">
            <Input value={empresaActiva.plan?.nombre ?? ''} disabled />
          </Field>
          <Field label="Estado suscripción">
            <Input
              value={
                empresaActiva.suscripcion_hasta
                  ? `Activa hasta ${empresaActiva.suscripcion_hasta}`
                  : empresaActiva.trial_hasta
                    ? `Trial hasta ${empresaActiva.trial_hasta}`
                    : 'Sin plan'
              }
              disabled
            />
          </Field>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Los datos generales de la empresa se editan desde el módulo de suscripción (próximamente).
        </div>
      </Card>

      {/* === Configuración fiscal / operativa === */}
      <Card className="p-5 mb-4">
        <SectionTitle icon={FileText} label="Facturación electrónica" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Resolución DIAN" hint="Número de resolución de habilitación">
            <Input
              value={config.resolucion_fe ?? ''}
              onChange={(e) => set('resolucion_fe', e.target.value)}
              placeholder="18760000001"
            />
          </Field>
          <Field label="Fecha de resolución">
            <Input
              type="date"
              value={config.resolucion_fecha ?? ''}
              onChange={(e) => set('resolucion_fecha', e.target.value)}
            />
          </Field>
          <Field label="Prefijo (ej. FCON)">
            <Input
              value={config.prefijo_fe ?? ''}
              onChange={(e) => set('prefijo_fe', e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="FCON"
            />
          </Field>
          <Field label="Iniciar consecutivo en">
            <Input
              type="number"
              value={config.iniciar_factura_en}
              onChange={(e) => set('iniciar_factura_en', parseInt(e.target.value) || 1)}
              min={1}
            />
          </Field>
          <Field label="Rango desde">
            <Input
              type="number"
              value={config.rango_desde ?? ''}
              onChange={(e) => set('rango_desde', parseInt(e.target.value) || null)}
              min={0}
            />
          </Field>
          <Field label="Rango hasta">
            <Input
              type="number"
              value={config.rango_hasta ?? ''}
              onChange={(e) => set('rango_hasta', parseInt(e.target.value) || null)}
              min={0}
            />
          </Field>
        </div>

        <div className="border-t mt-5 pt-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reglas de venta</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Toggle
              checked={config.iva_incluido}
              onChange={(v) => set('iva_incluido', v)}
              label="Precios con IVA incluido"
            />
            <Toggle
              checked={config.agente_retenedor}
              onChange={(v) => set('agente_retenedor', v)}
              label="Somos agente retenedor"
            />
            <Toggle
              checked={config.autorizar_devoluciones}
              onChange={(v) => set('autorizar_devoluciones', v)}
              label="Requiere admin para devoluciones"
            />
            <Toggle
              checked={config.autorizar_anulaciones}
              onChange={(v) => set('autorizar_anulaciones', v)}
              label="Requiere admin para anular"
            />
            <Toggle
              checked={config.permitir_facturar_negativo}
              onChange={(v) => set('permitir_facturar_negativo', v)}
              label="Permitir facturar sin stock"
            />
            <Toggle
              checked={config.usar_familias}
              onChange={(v) => set('usar_familias', v)}
              label="Usar familias de productos"
            />
            <Toggle
              checked={config.usar_lotes}
              onChange={(v) => set('usar_lotes', v)}
              label="Control por lotes / vencimientos"
            />
            <Toggle
              checked={config.imprimir_cotizacion}
              onChange={(v) => set('imprimir_cotizacion', v)}
              label="Imprimir cotización al guardar"
            />
          </div>
        </div>
      </Card>

      {/* === Representante legal === */}
      <Card className="p-5 mb-4">
        <SectionTitle icon={User} label="Representante legal" />
        <div className="text-xs text-gray-500 mb-3">
          Obligatorio para emisión de eventos DIAN (acuse de recibo, aceptación, etc.).
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Tipo doc.">
            <Select
              value={config.representante_tipo_doc_id ?? ''}
              onChange={(e) => set('representante_tipo_doc_id', parseInt(e.target.value) || null)}
            >
              <option value="">—</option>
              <option value="13">Cédula (13)</option>
              <option value="22">Cédula extranjería (22)</option>
              <option value="41">Pasaporte (41)</option>
            </Select>
          </Field>
          <Field label="Número documento" required>
            <Input
              value={config.representante_numero ?? ''}
              onChange={(e) => set('representante_numero', e.target.value)}
            />
          </Field>
          <Field label="DV">
            <Input
              value={config.representante_dv ?? ''}
              onChange={(e) => set('representante_dv', e.target.value)}
              maxLength={2}
            />
          </Field>
          <Field label="Primer nombre" required>
            <Input
              value={config.representante_primer_nombre ?? ''}
              onChange={(e) => set('representante_primer_nombre', e.target.value)}
            />
          </Field>
          <Field label="Segundo nombre">
            <Input
              value={config.representante_segundo_nombre ?? ''}
              onChange={(e) => set('representante_segundo_nombre', e.target.value)}
            />
          </Field>
          <div />
          <Field label="Primer apellido" required>
            <Input
              value={config.representante_primer_apellido ?? ''}
              onChange={(e) => set('representante_primer_apellido', e.target.value)}
            />
          </Field>
          <Field label="Segundo apellido">
            <Input
              value={config.representante_segundo_apellido ?? ''}
              onChange={(e) => set('representante_segundo_apellido', e.target.value)}
            />
          </Field>
          <div />
          <Field label="Cargo">
            <Input
              value={config.representante_cargo}
              onChange={(e) => set('representante_cargo', e.target.value)}
            />
          </Field>
          <Field label="Área / Departamento">
            <Input
              value={config.representante_area}
              onChange={(e) => set('representante_area', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={saving}>
          <Save size={14} /> {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 mb-4 border-b">
      <Icon size={18} className="text-primary-600" />
      <div className="text-base font-semibold">{label}</div>
    </div>
  );
}
