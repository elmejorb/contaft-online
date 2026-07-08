import { Save, X, Layers } from 'lucide-react';
import { Button, Field, Modal } from '../components/ui';

/* ================================================================
 * Modal Crear/Editar Producto — port fiel del EditarArticuloModal
 * del desktop. Preserva:
 *   - Inputs no controlados (defaultValue + onBlur) para evitar
 *     re-renders que mueven el cursor mientras se tipea.
 *   - Sincronización DOM directa de %/precio/utilidad — al cambiar
 *     un campo se actualizan sus hermanos sin re-render.
 *   - Formato moneda al blur, número crudo al focus.
 *   - Enter salta al siguiente input de precio.
 *   - soloNumeros: bloquea teclas no numéricas.
 *   - Precio_Costo se ALMACENA CON IVA (convención desktop).
 * ============================================================== */

export interface ProductoForm {
  Items: number;              // id (o 0 en nuevo — se muestra "Auto")
  Codigo: string;
  Nombres_Articulo: string;
  Precio_Costo: number;       // CON IVA incluido
  Precio_Venta: number;       // Precio1 — CON IVA
  Precio_Venta2: number;
  Precio_Venta3: number;
  Precio_Minimo: number;
  Iva: number;
  Existencia: number;
  Existencia_minima: number;
  Id_Categoria: number;
  CodigoPro: number;
  Estante: string;
  Estado: 0 | 1;
  Servicio: 0 | 1;
  Id_Etiqueta: number;
}

interface CatOpt { id: number; nombre: string }
interface ProvOpt { id: number; nombre: string }
interface EtiquetaOpt { id: number; nombre: string; color?: string }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  form: ProductoForm;
  onChange: (f: ProductoForm) => void;
  onSave: () => void;
  saving: boolean;
  categorias: CatOpt[];
  proveedores: ProvOpt[];
  etiquetas: EtiquetaOpt[];
  esNuevo: boolean;
  onOpenComponentes?: () => void;
}

const fmtMoneda = (v: number) => '$ ' + Math.round(v || 0).toLocaleString('es-CO');
const fmt = fmtMoneda;
const toNum = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;

// Enter dentro del fieldset "Detalle" salta al siguiente input marcado con data-precio
function soloNumeros(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const container = (e.target as HTMLElement).closest('[data-fs="detalle"]');
    if (!container) return;
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[data-precio]'));
    const idx = inputs.indexOf(e.target as HTMLInputElement);
    if (idx >= 0 && idx < inputs.length - 1) {
      (e.target as HTMLInputElement).blur();
      setTimeout(() => inputs[idx + 1].focus(), 10);
    }
    return;
  }
  const ok = ['0','1','2','3','4','5','6','7','8','9','.','Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
  if (!ok.includes(e.key)) e.preventDefault();
  if (e.key === '.' && (e.target as HTMLInputElement).value.includes('.')) e.preventDefault();
}

export function ProductoModal({
  isOpen, onClose, form, onChange, onSave, saving,
  categorias, proveedores, etiquetas, esNuevo, onOpenComponentes,
}: Props) {
  const set = <K extends keyof ProductoForm>(f: K, v: ProductoForm[K]) =>
    onChange({ ...form, [f]: v });

  if (!isOpen) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={esNuevo ? 'Nuevo Producto' : 'Editar Producto'}
      size="md"
      footer={
        <div className="flex gap-2 w-full justify-end">
          {!esNuevo && form.Items > 0 && onOpenComponentes && (
            <Button variant="secondary" onClick={onOpenComponentes} className="mr-auto text-primary-700 border-primary-200">
              <Layers size={14} /> Componentes
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            <X size={14} /> Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando…' : esNuevo ? 'Crear Producto' : 'Guardar'}
          </Button>
        </div>
      }
    >
      {/* key fuerza remount de todos los inputs no-controlados al cambiar
          de producto (ej. abrir editar sobre otro) — sino los defaultValue
          se quedan pegados al item anterior. */}
      <div key={esNuevo ? 'nuevo' : `${form.Items}-${form.Precio_Costo}-${form.Precio_Venta}`}
           className="space-y-2.5">

        {/* Selector Producto / Servicio */}
        <div className="grid grid-cols-2 gap-2">
          <TypeButton
            active={form.Servicio === 0}
            title="Producto físico"
            desc="descuenta inventario al vender"
            onClick={() => set('Servicio', 0)}
          />
          <TypeButton
            active={form.Servicio === 1}
            title="Servicio"
            desc="sin inventario, concepto editable al facturar"
            onClick={() => set('Servicio', 1)}
          />
        </div>

        {/* Datos del Producto */}
        <Fieldset legend={`Datos del ${form.Servicio ? 'Servicio' : 'Producto'}`}>
          <div className="grid grid-cols-12 gap-2 mb-2">
            <Field label="Items" className="col-span-3">
              <BaseInput value={esNuevo ? 'Auto' : String(form.Items)} disabled />
            </Field>
            <Field label="Código" className="col-span-6">
              <BaseInput
                value={form.Codigo}
                onChange={(e) => set('Codigo', e.target.value)}
              />
            </Field>
            <Field label="Estado" className="col-span-3">
              <BaseSelect
                value={form.Estado}
                onChange={(e) => set('Estado', parseInt(e.target.value) as 0 | 1)}
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </BaseSelect>
            </Field>
          </div>
          <Field label="Descripción" className="mb-2">
            <BaseInput
              value={form.Nombres_Articulo}
              onChange={(e) => set('Nombres_Articulo', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Proveedor">
              <BaseSelect
                value={form.CodigoPro}
                onChange={(e) => set('CodigoPro', parseInt(e.target.value))}
                disabled={proveedores.length === 0}
              >
                <option value={0}>-- Seleccionar --</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </BaseSelect>
            </Field>
            <Field label="Categoría">
              <BaseSelect
                value={form.Id_Categoria}
                onChange={(e) => set('Id_Categoria', parseInt(e.target.value))}
              >
                <option value={0}>-- Seleccionar --</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </BaseSelect>
            </Field>
            <Field label="Etiqueta">
              <BaseSelect
                value={form.Id_Etiqueta}
                onChange={(e) => set('Id_Etiqueta', parseInt(e.target.value))}
              >
                <option value={0}>-- Sin clasificar --</option>
                {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
              </BaseSelect>
            </Field>
          </div>
        </Fieldset>

        {/* Existencias + Ubicación — solo productos físicos */}
        {form.Servicio === 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Fieldset legend="Existencias" compact>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Cantidad ${esNuevo ? '(inicial)' : '(actual)'}`}>
                  <input
                    type="text"
                    defaultValue={form.Existencia}
                    onKeyDown={soloNumeros}
                    onBlur={(e) => set('Existencia', toNum(e.target.value))}
                    className={inputCls('bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold')}
                    placeholder="0"
                    title={esNuevo ? 'Stock inicial — genera entrada de Carga Inicial en el kárdex' : 'Si lo cambias se registrará la diferencia como Entrada/Salida en el kárdex'}
                  />
                </Field>
                <Field label="Exist. mínima">
                  <input
                    type="text"
                    defaultValue={form.Existencia_minima}
                    onKeyDown={soloNumeros}
                    onBlur={(e) => set('Existencia_minima', toNum(e.target.value))}
                    className={inputCls('bg-rose-50 border-rose-200')}
                  />
                </Field>
              </div>
            </Fieldset>
            <Fieldset legend="Ubicación" compact>
              <Field label="Estante">
                <BaseInput
                  value={form.Estante}
                  onChange={(e) => set('Estante', e.target.value)}
                />
              </Field>
            </Fieldset>
          </div>
        )}

        {/* Detalle (precios) */}
        <Fieldset legend={form.Servicio ? 'Precios e IVA' : 'Detalle'} dataFs="detalle">
          {form.Servicio ? (
            <div className="max-w-[220px] mb-2">
              <Field label="IVA %">
                <BaseSelect
                  value={form.Iva}
                  onChange={(e) => set('Iva', parseFloat(e.target.value))}
                >
                  <option value={0}>Exento (0%)</option>
                  <option value={5}>HR (5%)</option>
                  <option value={19}>IVA (19%)</option>
                </BaseSelect>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Field label="Costo sin IVA">
                <input
                  type="text"
                  data-precio="true" data-costo-sin-iva="true"
                  defaultValue={fmtMoneda(form.Iva > 0 ? form.Precio_Costo / (1 + form.Iva / 100) : form.Precio_Costo)}
                  onKeyDown={soloNumeros}
                  onFocus={(e) => {
                    const sinIva = form.Iva > 0 ? form.Precio_Costo / (1 + form.Iva / 100) : form.Precio_Costo;
                    e.target.value = String(Math.round(sinIva) || '');
                    e.target.select();
                  }}
                  onBlur={(e) => {
                    const sinIva = toNum(e.target.value);
                    const conIva = sinIva * (1 + form.Iva / 100);
                    set('Precio_Costo', conIva);
                    e.target.value = fmtMoneda(sinIva);
                    const conIvaInput = document.querySelector<HTMLInputElement>('[data-costo-con-iva]');
                    if (conIvaInput) conIvaInput.value = fmtMoneda(conIva);
                  }}
                  className={inputCls('bg-yellow-50 border-yellow-300 font-semibold')}
                />
              </Field>
              <Field label="IVA %">
                <BaseSelect
                  value={form.Iva}
                  onChange={(e) => {
                    const nuevo = parseFloat(e.target.value);
                    set('Iva', nuevo);
                    // Re-render pinta el sin-IVA; el con-IVA (Precio_Costo) no cambia
                    setTimeout(() => {
                      const sinIva = nuevo > 0 ? form.Precio_Costo / (1 + nuevo / 100) : form.Precio_Costo;
                      const sinIvaInput = document.querySelector<HTMLInputElement>('[data-costo-sin-iva]');
                      if (sinIvaInput) sinIvaInput.value = fmtMoneda(sinIva);
                    }, 20);
                  }}
                >
                  <option value={0}>Exento (0%)</option>
                  <option value={5}>HR (5%)</option>
                  <option value={19}>IVA (19%)</option>
                </BaseSelect>
              </Field>
              <Field label="Costo con IVA">
                <input
                  type="text"
                  data-precio="true" data-costo-con-iva="true"
                  defaultValue={fmtMoneda(form.Precio_Costo)}
                  onKeyDown={soloNumeros}
                  onFocus={(e) => { e.target.value = String(Math.round(form.Precio_Costo) || ''); e.target.select(); }}
                  onBlur={(e) => {
                    const conIva = toNum(e.target.value);
                    set('Precio_Costo', conIva);
                    e.target.value = fmtMoneda(conIva);
                    const sinIva = form.Iva > 0 ? conIva / (1 + form.Iva / 100) : conIva;
                    const sinIvaInput = document.querySelector<HTMLInputElement>('[data-costo-sin-iva]');
                    if (sinIvaInput) sinIvaInput.value = fmtMoneda(sinIva);
                  }}
                  className={inputCls('bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold')}
                />
              </Field>
            </div>
          )}

          {/* Tabla precios */}
          <div
            className={`grid gap-x-1.5 gap-y-1 items-center text-xs`}
            style={{ gridTemplateColumns: form.Servicio ? '95px 1fr' : '85px 65px 1fr 80px' }}
          >
            {/* Headers */}
            <span></span>
            {form.Servicio === 0 && <HeaderMini align="center">% Increm.</HeaderMini>}
            <HeaderMini align="center">Precio Venta</HeaderMini>
            {form.Servicio === 0 && <HeaderMini align="right">Utilidad $</HeaderMini>}

            {([
              { label: 'P. al Público 1', field: 'Precio_Venta',   val: form.Precio_Venta,   main: true  },
              { label: 'P. al Público 2', field: 'Precio_Venta2',  val: form.Precio_Venta2,  main: false },
              { label: 'P. al Público 3', field: 'Precio_Venta3',  val: form.Precio_Venta3,  main: false },
              { label: 'P. Mínimo',       field: 'Precio_Minimo',  val: form.Precio_Minimo,  main: false },
            ] as const).map((row) => {
              const cIva = form.Precio_Costo;
              const pct = cIva > 0 ? ((row.val - cIva) / cIva) * 100 : 0;
              const ganancia = row.val - cIva;

              // Sincroniza hermanos sin re-render — al blur de %/precio actualiza
              // el otro input y el span de utilidad.
              const syncSiblings = (container: HTMLElement, newPrice: number) => {
                const pctInput = container.querySelector<HTMLInputElement>(`[data-pct="${row.field}"]`);
                const priceInput = container.querySelector<HTMLInputElement>(`[data-price="${row.field}"]`);
                const utilSpan = container.querySelector<HTMLSpanElement>(`[data-util="${row.field}"]`);
                const newPct = cIva > 0 ? ((newPrice - cIva) / cIva) * 100 : 0;
                const newGan = newPrice - cIva;
                if (pctInput && document.activeElement !== pctInput) pctInput.value = newPct.toFixed(2) + '%';
                if (priceInput && document.activeElement !== priceInput) priceInput.value = fmtMoneda(newPrice);
                if (utilSpan) {
                  utilSpan.textContent = fmt(newGan);
                  utilSpan.className = utilSpan.className.replace(/text-(emerald|red)-\d+/g, '')
                    + ` ${newGan >= 0 ? 'text-emerald-600' : 'text-red-600'}`;
                }
              };

              const cells: React.ReactNode[] = [];
              cells.push(
                <span
                  key={row.field + '_l'}
                  className={`text-xs text-gray-600 ${row.main ? 'font-semibold' : ''}`}
                >{row.label}</span>
              );
              if (form.Servicio === 0) {
                cells.push(
                  <input
                    key={row.field + '_pct'}
                    type="text"
                    data-precio="true" data-pct={row.field}
                    defaultValue={pct > 0 ? pct.toFixed(2) + '%' : '0.00%'}
                    onKeyDown={soloNumeros}
                    onFocus={(e) => { e.target.value = pct > 0 ? pct.toFixed(2) : ''; e.target.select(); }}
                    onBlur={(e) => {
                      const newPct = toNum(e.target.value);
                      const newPrice = Math.round(cIva * (1 + newPct / 100));
                      set(row.field, newPrice);
                      e.target.value = newPct.toFixed(2) + '%';
                      const fs = e.target.closest('[data-fs="detalle"]') as HTMLElement | null;
                      if (fs) syncSiblings(fs, newPrice);
                    }}
                    className={inputCls('h-7 text-center bg-gray-50')}
                  />
                );
              }
              cells.push(
                <input
                  key={row.field + '_price'}
                  type="text"
                  data-precio="true" data-price={row.field}
                  defaultValue={fmtMoneda(row.val)}
                  onKeyDown={soloNumeros}
                  onFocus={(e) => { e.target.value = String(row.val || ''); e.target.select(); }}
                  onBlur={(e) => {
                    const num = toNum(e.target.value);
                    set(row.field, num);
                    e.target.value = fmtMoneda(num);
                    const fs = e.target.closest('[data-fs="detalle"]') as HTMLElement | null;
                    if (fs) syncSiblings(fs, num);
                  }}
                  className={inputCls(
                    `h-7 ${row.main
                      ? 'font-semibold border-primary-500 ring-1 ring-primary-200'
                      : 'bg-gray-50'}`
                  )}
                />
              );
              if (form.Servicio === 0) {
                cells.push(
                  <span
                    key={row.field + '_g'}
                    data-util={row.field}
                    className={`text-right text-xs font-medium tabular-nums ${ganancia >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  >{fmt(ganancia)}</span>
                );
              }
              return cells;
            })}
          </div>
        </Fieldset>
      </div>
    </Modal>
  );
}

/* ---------- helpers ---------- */

function TypeButton({
  active, title, desc, onClick,
}: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border-2 text-left transition ${
        active ? 'border-primary-500 bg-primary-50/60 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className={`text-xs font-bold ${active ? 'text-primary-700' : 'text-gray-700'}`}>{title}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
    </button>
  );
}

function Fieldset({
  legend, children, compact, dataFs,
}: { legend: string; children: React.ReactNode; compact?: boolean; dataFs?: string }) {
  return (
    <fieldset
      data-fs={dataFs}
      className={`border border-gray-200 rounded-lg bg-white ${compact ? 'px-3 py-2' : 'px-3 py-2.5'}`}
    >
      <legend className="text-[10px] font-bold text-primary-700 uppercase tracking-wider px-1">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function HeaderMini({ children, align }: { children: React.ReactNode; align: 'center' | 'right' }) {
  return (
    <span className={`text-[9px] text-gray-400 font-semibold uppercase tracking-wider text-${align}`}>
      {children}
    </span>
  );
}

function inputCls(extra = '') {
  return `w-full h-7 px-2 border border-gray-300 rounded-md text-xs bg-white text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-400 ${extra}`;
}

function BaseInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls(props.className)} />;
}
function BaseSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputCls('pr-5 ' + (props.className ?? ''))} />;
}

