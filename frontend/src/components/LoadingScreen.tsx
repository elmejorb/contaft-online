import { useEffect, useState } from 'react';
import appIcon from '../assets/icon.png';

/* ================================================================
 * LoadingScreen — port 1:1 del SubscriptionGate del desktop (Conta FT
 * Facturación). Valores COPIADOS del original — mismo fondo, tamaños,
 * animaciones y píldora — así la online y el desktop se sienten
 * gemelos al arrancar.
 *
 * Ref: Dashboard-Facturación/src/components/SubscriptionGate.tsx L135-207
 * ============================================================== */

interface Props {
  message?: string;
  cyclingMessages?: string[];
}

export function LoadingScreen({ message = 'Verificando suscripción...', cyclingMessages }: Props) {
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #6d28d9 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff', overflow: 'hidden',
    }}>
      {/* Glow decorativo de fondo — 600x600 con blur 60 */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* Logo + ring spinner */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 28 }}>
        {/* Anillo girando */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.12)',
          borderTopColor: '#a78bfa', borderRightColor: '#c4b5fd',
          animation: 'ls-spin 1.2s linear infinite',
        }} />
        {/* Logo central con pulse */}
        <div style={{
          position: 'absolute', inset: 14, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
          boxShadow: '0 12px 40px rgba(124,58,237,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'ls-pulse 2s ease-in-out infinite',
        }}>
          <img src={appIcon} alt="Conta FT" style={{ width: 56, height: 56 }} />
        </div>
      </div>

      {/* Brand */}
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>
        Conta <span style={{ color: '#a78bfa' }}>FT</span>
      </div>
      <div style={{ fontSize: 11, color: '#c4b5fd', letterSpacing: 3, fontWeight: 500, marginBottom: 28 }}>
        FACTURACIÓN
      </div>

      {/* Píldora de estado */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '10px 18px', borderRadius: 999,
        fontSize: 13, fontWeight: 500, color: '#e9d5ff',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#22d3ee',
          boxShadow: '0 0 12px #22d3ee',
          animation: 'ls-blink 1.4s ease-in-out infinite',
        }} />
        {currentMsg}
      </div>

      <style>{`
        @keyframes ls-spin { to { transform: rotate(360deg); } }
        @keyframes ls-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
        @keyframes ls-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
