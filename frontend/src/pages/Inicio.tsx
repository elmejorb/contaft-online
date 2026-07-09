import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Wallet, Package, Receipt, FileText, Truck,
  Users, BarChart3, Plus, ArrowRight, Bell, LogOut, User,
  ChevronDown, Building2, Menu,
} from 'lucide-react';
import appIcon from '../assets/icon.png';
import { useAuth } from '../contexts/AuthContext';

/* ================================================================
 * Pantalla de inicio — port 1:1 del desktop
 * (Dashboard-Facturación/src/components/PantallaInicio.tsx).
 *
 * Diferencias vs desktop:
 *   • Los módulos no implementados van con `disabled=true` y no se
 *     navegan (Ventas, Caja, FE DIAN, Cartera, Informes, Compras).
 *     Solo Inventario abre por ahora.
 *   • Header propio arriba (empresa + notif + usuario) porque esta
 *     ruta va FUERA del AppLayout — pantalla completa.
 *   • Notificaciones deshabilitadas hasta implementarlas.
 * ============================================================== */

interface Acceso {
  id: string;
  label: string;
  desc: string;
  icon: typeof ShoppingCart;
  color: string;
  bg: string;
  path?: string;         // si tiene ruta, navega; si no, muestra "Próximamente"
  disabled?: boolean;
}

export function InicioPage() {
  const nav = useNavigate();
  const { usuario, empresaActiva, empresas, switchEmpresa, logout } = useAuth();

  const [hora, setHora] = useState(new Date());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [empresaMenuOpen, setEmpresaMenuOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const horaStr = hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const fechaStr = hora.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const saludo = (() => {
    const h = hora.getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  const nombre = usuario?.nombre || '';

  // Partículas decorativas — memoizadas para que no se regeneren cada segundo
  const particulas = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 3,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 8,
    opacity: 0.15 + Math.random() * 0.4,
  })), []);

  const accesos: Acceso[] = [
    { id: 'nueva-venta', label: 'Nueva Venta',  desc: 'Facturar al cliente',           icon: ShoppingCart, color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)', disabled: true },
    { id: 'caja',        label: 'Caja',         desc: 'Sesión y cuadre del día',       icon: Wallet,       color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', disabled: true },
    { id: 'inventario',  label: 'Inventario',   desc: 'Productos y stock',             icon: Package,      color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)', path: '/productos' },
    { id: 'sales',       label: 'Ventas',       desc: 'Historial y devoluciones',      icon: Receipt,      color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.18)', disabled: true },
    { id: 'fe-dian',     label: 'FE DIAN',      desc: 'Envíos y reportes electrónicos',icon: FileText,     color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)',  disabled: true },
    { id: 'cartera',     label: 'Cartera',      desc: 'Cobros pendientes',             icon: Users,        color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)',  disabled: true },
    { id: 'informes',    label: 'Informes',     desc: '22+ reportes',                  icon: BarChart3,    color: '#ec4899', bg: 'rgba(236, 72, 153, 0.18)', disabled: true },
    { id: 'compras',     label: 'Compras',      desc: 'Pedidos a proveedores',         icon: Truck,        color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.18)', path: '/proveedores' },
  ];

  const empresaSubtitulo = empresaActiva
    ? `NIT: ${empresaActiva.nit}${empresaActiva.plan?.nombre ? ' · ' + empresaActiva.plan.nombre : ''}`
    : '';

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b 0%, oklch(.424 .199 265.638) 35%, oklch(.42 .26 295) 100%)',
      overflow: 'hidden',
    }}>
      {/* ============ Mesh gradient overlay ============ */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '-10%', width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.45) 0%, transparent 60%)',
          filter: 'blur(80px)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%', width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 60%)',
          filter: 'blur(80px)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '50%', width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.2) 0%, transparent 60%)',
          filter: 'blur(80px)', borderRadius: '50%', transform: 'translate(-50%, -50%)',
        }} />

        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}
             viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0,500 Q300,380 600,500 T1200,500" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M0,600 Q300,510 600,600 T1200,600" stroke="white" strokeWidth="1" fill="none" />
          <path d="M0,400 Q300,300 600,400 T1200,400" stroke="white" strokeWidth="1" fill="none" />
          <path d="M0,300 Q300,210 600,300 T1200,300" stroke="white" strokeWidth="0.8" fill="none" />
        </svg>

        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {particulas.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: `${p.left}%`, top: `${p.top}%`,
            width: p.size, height: p.size, background: '#fff', borderRadius: '50%',
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px rgba(255,255,255,${p.opacity})`,
            animation: `floatY ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }} />
        ))}
      </div>

      {/* ============ HEADER — empresa + notif + user ============ */}
      <div style={{
        position: 'relative', zIndex: 20, height: 64,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px',
      }}>
        {/* Menu botón — abre el sidebar navegando a /clientes u otra ruta */}
        <button
          onClick={() => nav('/clientes')}
          title="Ir al panel completo"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        >
          <Menu size={18} />
        </button>

        {/* Info empresa activa */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {empresas.length > 1 ? (
            <button
              onClick={() => setEmpresaMenuOpen(o => !o)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#fff', padding: 0, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.1, textTransform: 'uppercase' }}>
                  {empresaActiva?.razon_social}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  {empresaSubtitulo}
                </div>
              </div>
              <ChevronDown size={14} style={{ opacity: 0.6 }} />
            </button>
          ) : (
            <div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.1, textTransform: 'uppercase' }}>
                {empresaActiva?.razon_social}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                {empresaSubtitulo}
              </div>
            </div>
          )}

          {empresaMenuOpen && empresas.length > 1 && (
            <>
              <div onClick={() => setEmpresaMenuOpen(false)}
                   style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
              <div style={{
                position: 'absolute', top: 56, left: 60, zIndex: 40,
                background: '#fff', borderRadius: 10, minWidth: 260,
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                padding: 6,
              }}>
                {empresas.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { switchEmpresa(e.id); setEmpresaMenuOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: e.id === empresaActiva?.id ? '#f5f3ff' : 'transparent',
                      border: 'none', borderRadius: 6, padding: '8px 10px',
                      cursor: 'pointer', color: '#111827',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={13} /> {e.razon_social}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>NIT: {e.nit}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notificaciones — deshabilitado por ahora */}
        <button
          disabled
          title="Notificaciones (próximamente)"
          style={{
            width: 36, height: 36, borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.55)', cursor: 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Bell size={16} />
        </button>

        {/* Usuario */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>
              {nombre.charAt(0).toUpperCase() || 'U'}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{nombre}</span>
          </button>

          {userMenuOpen && (
            <>
              <div onClick={() => setUserMenuOpen(false)}
                   style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 40,
                background: '#fff', borderRadius: 10, minWidth: 220,
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)', padding: 6,
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{nombre}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{usuario?.email}</div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); nav('/empresa'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', border: 'none', borderRadius: 6,
                    color: '#111827', fontSize: 13, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f3ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <User size={14} /> Perfil / Empresa
                </button>
                <button
                  onClick={logout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', border: 'none', borderRadius: 6,
                    color: '#dc2626', fontSize: 13, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============ CONTENIDO CENTRAL ============ */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 18px 40px',
      }}>
        {/* Hero: logo + título + saludo + reloj */}
        <div className="hero-fade" style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="logo-float" style={{ display: 'inline-block', position: 'relative', marginBottom: 4 }}>
            <div style={{
              position: 'absolute', inset: -8,
              background: 'radial-gradient(circle, rgba(196, 181, 253, 0.4) 0%, transparent 70%)',
              filter: 'blur(18px)', borderRadius: '50%',
            }} />
            <img src={appIcon} alt="Conta FT" style={{
              width: 78, height: 78, objectFit: 'contain', position: 'relative',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
            }} />
          </div>

          <h1 style={{
            fontSize: 'clamp(42px, 6vw, 60px)', fontWeight: 800, margin: '0 0 2px', letterSpacing: -2,
            background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f0abfc 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            textShadow: '0 4px 30px rgba(196, 181, 253, 0.5)',
            lineHeight: 1,
          }}>
            Conta FT
          </h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontSize: 11, fontWeight: 700, color: '#c4b5fd', letterSpacing: 5,
            margin: '4px 0 12px', textTransform: 'uppercase',
          }}>
            <span style={{ height: 1, width: 24, background: 'linear-gradient(90deg, transparent, #c4b5fd)' }} />
            Facturación · Inventario · Contabilidad
            <span style={{ height: 1, width: 24, background: 'linear-gradient(90deg, #c4b5fd, transparent)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ color: 'rgba(255,255,255,0.92)', textAlign: 'left' }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{saludo}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {nombre || 'bienvenido'} 👋
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ color: '#fff', textAlign: 'left' }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
                {horaStr}
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, textTransform: 'capitalize', marginTop: 2 }}>
                {fechaStr}
              </div>
            </div>
          </div>
        </div>

        {/* Grid de accesos rápidos */}
        <div className="cards-fade" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
          maxWidth: 980, width: '100%',
        }}>
          {accesos.map((acc, i) => {
            const Icon = acc.icon;
            const onClick = () => {
              if (acc.disabled) return;
              if (acc.path) nav(acc.path);
            };
            return (
              <button
                key={acc.id}
                onClick={onClick}
                disabled={acc.disabled}
                className="acc-card"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: '12px 14px',
                  cursor: acc.disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left' as const, color: '#fff',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: `cardEnter 0.5s ${0.3 + i * 0.05}s both ease-out`,
                  display: 'flex', flexDirection: 'column', gap: 6, minHeight: 84,
                  opacity: acc.disabled ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: acc.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${acc.color}40`,
                  }}>
                    <Icon size={20} color={acc.color} />
                  </div>
                  {acc.disabled ? (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 999 }}>
                      PRÓX.
                    </span>
                  ) : (
                    <ArrowRight size={14} color="rgba(255,255,255,0.4)" className="acc-arrow" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{acc.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{acc.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Hint */}
        <div style={{
          marginTop: 22, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Plus size={11} /> O usa el menú lateral para acceder a más opciones
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, zIndex: 10,
      }}>
        Conta FT Online · Facturación Electrónica DIAN
      </div>

      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0) translateX(0); }
          25%      { transform: translateY(-15px) translateX(8px); }
          50%      { transform: translateY(-8px)  translateX(-6px); }
          75%      { transform: translateY(-20px) translateX(4px); }
        }
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .hero-fade  { animation: heroFade 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
        .cards-fade { animation: heroFade 0.7s 0.2s both cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .logo-float { animation: logoFloat 4s ease-in-out infinite; }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)  scale(1);    }
        }
        .acc-card:not(:disabled):hover {
          background: rgba(255,255,255,0.12) !important;
          border-color: rgba(255,255,255,0.25) !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px -10px rgba(0,0,0,0.4);
        }
        .acc-card:not(:disabled):hover .acc-arrow {
          color: #fff !important;
          transform: translateX(3px);
        }
        .acc-arrow { transition: all 0.2s; }
      `}</style>

    </div>
  );
}
