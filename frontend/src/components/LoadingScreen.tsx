import { useEffect, useState } from 'react';

/* ================================================================
 * LoadingScreen — splash violeta con marca. Se usa:
 *   1. Bootstrap inicial (App carga /landlord/me para restaurar sesión)
 *   2. Después del submit de login mientras hace /login + /me
 *   3. En el switch de empresa (opcional)
 *
 * Diseño:
 *   - Fondo gradient primary-600 → primary-800 fullscreen
 *   - Marca "Conta FT" grande, blanca, con fade-in
 *   - Spinner tipo "orbita" — 2 anillos que giran a distinta velocidad
 *   - Mensaje dinámico opcional que rota si tarda
 *   - Barra de progreso indeterminada abajo, sutil
 * ============================================================== */

interface Props {
  /** Mensaje principal. Si no se pasa, no muestra texto. */
  message?: string;
  /** Mensajes que rotan cada ~1.2s mientras el splash está visible. */
  cyclingMessages?: string[];
}

export function LoadingScreen({ message, cyclingMessages }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!cyclingMessages || cyclingMessages.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % cyclingMessages.length);
    }, 1200);
    return () => clearInterval(t);
  }, [cyclingMessages]);

  const currentMsg = cyclingMessages?.[idx] ?? message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 overflow-hidden">
      {/* Bloom decorativo — círculos difusos para dar profundidad */}
      <div className="absolute top-1/4 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-1/4 -right-16 w-96 h-96 rounded-full bg-primary-400/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-8 animate-[fadeIn_400ms_ease-out]">
        {/* Marca */}
        <div className="text-center">
          <div className="text-4xl font-bold text-white tracking-tight drop-shadow-sm">
            Conta<span className="text-primary-200">FT</span>
          </div>
          <div className="text-[11px] text-primary-100/80 uppercase tracking-[0.3em] mt-1 font-semibold">
            Online
          </div>
        </div>

        {/* Spinner tipo órbita — 3 elementos giratorios */}
        <div className="relative w-16 h-16">
          {/* Anillo exterior — gira lento */}
          <div className="absolute inset-0 rounded-full border-2 border-primary-300/30 border-t-white animate-spin" style={{ animationDuration: '1.4s' }} />
          {/* Anillo interior — gira más rápido, sentido contrario */}
          <div className="absolute inset-2 rounded-full border-2 border-primary-200/20 border-b-primary-200 animate-spin" style={{ animationDuration: '0.9s', animationDirection: 'reverse' }} />
          {/* Punto central */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white shadow-lg shadow-white/50 animate-pulse" />
          </div>
        </div>

        {/* Mensaje */}
        {currentMsg && (
          <div className="min-h-[20px]">
            <div className="text-sm text-white/90 font-medium tracking-wide text-center animate-[fadeIn_300ms_ease-out]" key={currentMsg}>
              {currentMsg}
            </div>
          </div>
        )}

        {/* Barra de progreso indeterminada */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-white/70 rounded-full animate-[slide_1.6s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Keyframes locales — Tailwind no los conoce por defecto */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
