import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

/* ================================================================
 * Moneda configurable + input con formato al perder el foco.
 *
 * La moneda de la empresa (empresa_config.moneda) se fija una vez con
 * setMoneda(); formatMoney() y <MoneyInput> la usan. Si la empresa es de
 * otro país, solo cambia la config y todo se ajusta (símbolo, separadores,
 * decimales).
 * ============================================================== */

export interface MonedaCfg { code: string; locale: string; decimals: number; symbol: string }

const MONEDAS: Record<string, MonedaCfg> = {
  COP: { code: 'COP', locale: 'es-CO', decimals: 0, symbol: '$' },
  USD: { code: 'USD', locale: 'en-US', decimals: 2, symbol: 'US$' },
  MXN: { code: 'MXN', locale: 'es-MX', decimals: 2, symbol: '$' },
  EUR: { code: 'EUR', locale: 'es-ES', decimals: 2, symbol: '€' },
  PEN: { code: 'PEN', locale: 'es-PE', decimals: 2, symbol: 'S/' },
  CLP: { code: 'CLP', locale: 'es-CL', decimals: 0, symbol: '$' },
  ARS: { code: 'ARS', locale: 'es-AR', decimals: 2, symbol: '$' },
};

let actual: MonedaCfg = MONEDAS.COP;

/** Fija la moneda activa (desde empresa_config.moneda). */
export function setMoneda(code?: string | null) {
  actual = MONEDAS[(code ?? 'COP').toUpperCase()] ?? MONEDAS.COP;
}
export function getMoneda(): MonedaCfg { return actual; }

/** "$ 10.000" (COP) / "US$ 10,000.00" (USD)… según la moneda activa. */
export function formatMoney(v: number | string | null | undefined): string {
  const n = Number(v ?? 0) || 0;
  return actual.symbol + ' ' + n.toLocaleString(actual.locale, {
    minimumFractionDigits: actual.decimals,
    maximumFractionDigits: actual.decimals,
  });
}

/**
 * Input de moneda: muestra el valor formateado ("$ 10.000") cuando NO tiene
 * foco, y el número crudo ("10000") al enfocarlo para editar cómodo.
 * onChange devuelve el número.
 */
export function MoneyInput({
  value, onChange, className, ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onChange: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const decimals = actual.decimals;

  const display = focused ? raw : (value ? formatMoney(value) : '');
  // Si el caller pasa className (aunque sea ''), respeta su estilo (p.ej. inline
  // del POS); si no, usa el look estándar de input.
  const base = 'w-full h-8 px-2.5 border border-gray-300 rounded-md text-sm font-medium bg-white text-gray-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 placeholder:text-gray-400 placeholder:font-normal';

  return (
    <input
      {...rest}
      inputMode="decimal"
      value={display}
      className={className === undefined ? base : className}
      onFocus={(e) => {
        setFocused(true);
        setRaw(value ? String(value) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        // Permite dígitos y (si la moneda usa decimales) un separador.
        let cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
        if (decimals === 0) cleaned = cleaned.replace(/[.,]/g, '');
        setRaw(cleaned);
        onChange(cleaned === '' ? 0 : Number(cleaned) || 0);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}
