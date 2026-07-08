import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes, MouseEvent } from 'react';
import { X } from 'lucide-react';

/* ================================================================
 * Componentes UI reusables — usados por Datos Empresa, Clientes,
 * Productos, Familias y las páginas que vengan. Todos con Tailwind y
 * la paleta primary (violeta) del sistema. Sin dependencias externas.
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
  primary:   'bg-primary-600 hover:bg-primary-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
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
      className={`h-9 px-4 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${btnClass[variant]} ${className}`}
    />
  );
}

// ---------- Field (label + input) ----------
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
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      )}
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="text-[11px] text-gray-500 mt-0.5 block">{hint}</span>}
      {error && <span className="text-[11px] text-red-600 mt-0.5 block">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${props.className ?? ''}`}
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
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

// ---------- Modal ----------
export function Modal({
  open, onClose, title, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={stop}
        className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
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
      <table className="min-w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`text-left font-semibold text-xs uppercase tracking-wide text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-200 ${className}`}>
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
