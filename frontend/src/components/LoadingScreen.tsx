import { useEffect, useState } from 'react';

/* ================================================================
 * LoadingScreen — port fiel del splash del desktop Conta FT.
 * Layout minimalista, jerárquico y elegante:
 *
 *   [ Logo circular grande con anillo giratorio · glow interior ]
 *
 *                    Conta FT
 *                   FACTURACIÓN
 *
 *              [ ● Verificando…       ]
 *
 * Sin barras de progreso separadas, sin spinner extra. El anillo
 * giratorio VIVE dentro del propio logo. La píldora con LED cyan
 * transmite el mensaje. Es más limpio y se lee como "app madura",
 * no como demo con muchos elementos.
 * ============================================================== */

interface Props {
  message?: string;
  cyclingMessages?: string[];
}

export function LoadingScreen({ message, cyclingMessages }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!cyclingMessages || cyclingMessages.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % cyclingMessages.length);
    }, 1400);
    return () => clearInterval(t);
  }, [cyclingMessages]);

  const currentMsg = cyclingMessages?.[idx] ?? message;

  return (
    <div
      className="fixed inset-0 z-50 min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, #7c3aed 0%, #5b21b6 45%, #4c1d95 100%)',
      }}
    >
      {/* Blob superior — brillo cálido morado */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-15%', left: '20%', width: 480, height: 480,
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.35) 0%, transparent 60%)',
          filter: 'blur(60px)', borderRadius: '50%',
        }}
      />
      {/* Blob inferior — azul frío */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-10%', right: '10%', width: 420, height: 420,
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.22) 0%, transparent 65%)',
          filter: 'blur(60px)', borderRadius: '50%',
        }}
      />

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center enter-anim">
        {/* ============ LOGO CIRCULAR GRANDE ============ */}
        <div className="relative mb-8" style={{ width: 168, height: 168 }}>
          {/* Anillo giratorio exterior — glow violeta */}
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 200deg, #c4b5fd 280deg, #a78bfa 340deg, transparent 360deg)',
              animationDuration: '2.4s',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              mask:
                'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              boxShadow: '0 0 30px rgba(167, 139, 250, 0.4)',
            }}
          />

          {/* Círculo del logo — fondo violeta claro */}
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              inset: 12,
              background:
                'radial-gradient(circle at 30% 30%, #8b5cf6 0%, #6d28d9 70%, #5b21b6 100%)',
              boxShadow:
                'inset 0 2px 20px rgba(255,255,255,0.15), inset 0 -8px 24px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            {/* Ícono: documento + moneda dorada. SVG inline para mimetizar
                exactamente al appIcon del desktop (documento con líneas +
                moneda amarilla al lado). */}
            <svg viewBox="0 0 100 100" width="88" height="88" aria-hidden>
              {/* Documento */}
              <g transform="translate(18 22)">
                <rect
                  x="0" y="0" width="46" height="58" rx="4"
                  fill="#ffffff"
                  stroke="rgba(0,0,0,0.08)" strokeWidth="1"
                />
                <path d="M 6 12 h 30" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 6 20 h 30" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 6 28 h 20" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
                {/* Pie del documento con acento */}
                <circle cx="10" cy="42" r="3" fill="#f59e0b" />
                <path d="M 16 42 h 18" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
                <path d="M 6 50 h 24" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
              </g>
              {/* Moneda dorada apilada */}
              <g transform="translate(52 46)">
                <circle cx="16" cy="16" r="15"
                  fill="url(#coinGrad)"
                  stroke="#b45309" strokeWidth="1"
                />
                <circle cx="16" cy="16" r="11" fill="none" stroke="#78350f" strokeWidth="1" opacity="0.35" />
                <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="900" fill="#78350f" fontFamily="system-ui">$</text>
              </g>
              <defs>
                <linearGradient id="coinGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="55%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Halo exterior sutil */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -6,
              boxShadow: '0 0 60px 8px rgba(167, 139, 250, 0.25)',
            }}
          />
        </div>

        {/* ============ Nombre ============ */}
        <div className="text-center mb-1">
          <div className="text-5xl text-white leading-none" style={{ letterSpacing: '-0.02em' }}>
            <span className="font-light">Conta</span>{' '}
            <span className="font-bold">FT</span>
          </div>
        </div>
        <div
          className="text-[11px] font-semibold mb-8"
          style={{ color: '#c4b5fd', letterSpacing: '6px' }}
        >
          FACTURACIÓN
        </div>

        {/* ============ Píldora del estado ============ */}
        {currentMsg && (
          <div
            key={currentMsg}
            className="msg-fade inline-flex items-center gap-2.5 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(30, 27, 75, 0.55)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(196, 181, 253, 0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            {/* LED cyan pulsante */}
            <span className="relative flex w-2 h-2">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: '#22d3ee', opacity: 0.75 }}
              />
              <span
                className="relative rounded-full w-2 h-2"
                style={{
                  background: '#22d3ee',
                  boxShadow: '0 0 8px rgba(34, 211, 238, 0.9)',
                }}
              />
            </span>
            <span className="text-sm font-medium text-white/95 tracking-wide whitespace-nowrap">
              {currentMsg}
            </span>
          </div>
        )}
      </div>

      {/* Animaciones locales */}
      <style>{`
        @keyframes enter {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .enter-anim { animation: enter 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes msgFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .msg-fade { animation: msgFade 0.35s ease-out; }
      `}</style>
    </div>
  );
}
