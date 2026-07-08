import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';

/* ================================================================
 * Componentes UI reusables — versión con "polish":
 *   - Modal con header en gradient primary (violeta)
 *   - Controles compactos h-8 + text-xs para ahorrar espacio vertical
 *   - Field labels más discretos
 *   - Botones con altura consistente h-8
 * ============================================================== */

// ---------- PageHeader ----------
export function PageHeader({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

// ---------- Card ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

// ---------- Button ----------
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const btnClass: Record<BtnVariant, string> = {
  primary:   'bg-primary-600 hover:bg-primary-700 text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-600',
};
export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...rest}
      className={`h-8 px-3 rounded-md text-xs font-semibold transition inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${btnClass[variant]} ${className}`}
    />
  );
}

// ---------- Field ----------
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none block mb-1">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      )}
      <div>{children}</div>
      {hint && !error && <span className="text-[10px] text-gray-400 mt-0.5 block leading-tight">{hint}</span>}
      {error && <span className="text-[10px] text-red-600 mt-0.5 block leading-tight">{error}</span>}
    </label>
  );
}

// Inputs: text-sm + font-medium para que el CONTENIDO destaque sobre
// los labels (que son text-[10px] uppercase). El contraste tipográfico
// hace que el ojo vaya al dato, no al rótulo.
const inputBase =
  'w-full h-8 px-2.5 border border-gray-300 rounded-md text-sm font-medium bg-white text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 ' +
  'disabled:bg-gray-50 disabled:text-gray-500 placeholder:text-gray-400 placeholder:font-normal';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputBase} ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} pr-6 ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 placeholder:text-gray-400 placeholder:font-normal ${props.className ?? ''}`}
    />
  );
}

export function Toggle({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition relative ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-xs text-gray-700">{label}</span>}
    </label>
  );
}

// ---------- Modal (con polish) ----------
// El modal NO se cierra al hacer click en el backdrop — solo con la X del
// header o el botón Cancelar del footer. Evita cerrarlo por accidente y
// perder cambios no guardados. Regla aplicada a todos los modales del
// sistema por defecto.
export function Modal({
  open, onClose, title, subtitle, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[92vh] flex flex-col overflow-hidden border border-gray-200`}
      >
        {/* Header con gradient — más compacto */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-primary-600 via-primary-600 to-primary-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white text-sm font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="text-primary-100 text-[10px] mt-0.5 leading-tight">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body — padding reducido para más densidad */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-4 py-2.5 border-t border-gray-200 bg-white flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Table ----------
export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full text-xs">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`text-left font-bold text-[10px] uppercase tracking-wider text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-200 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 border-b border-gray-100 ${className}`}>
      {children}
    </td>
  );
}

export function EmptyState({ message = 'No hay resultados', hint }: { message?: string; hint?: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-sm font-medium">{message}</div>
      {hint && <div className="text-xs mt-1">{hint}</div>}
    </div>
  );
}
