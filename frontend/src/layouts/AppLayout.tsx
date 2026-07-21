import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Boxes, Percent, FileText, ShoppingCart,
  Wallet, Settings, Building2, User, LogOut, ChevronDown, Menu, X, Truck, Calculator,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Layout persistente del panel autenticado. Sidebar navegable a la
 * izquierda, header con selector de empresa y menú de usuario, y
 * <Outlet /> para renderizar la ruta activa.
 *
 * Los items del menú se agrupan por área funcional. Los que aún no
 * están implementados llevan `disabled: true` y se muestran atenuados
 * con un badge "Próx." para que el usuario sepa qué está por venir.
 */

interface MenuItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}
interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const MENU: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/',          label: 'Inicio',   icon: LayoutDashboard },
    ],
  },
  {
    label: 'Datos maestros',
    items: [
      { to: '/clientes',    label: 'Clientes',    icon: Users },
      { to: '/proveedores', label: 'Proveedores', icon: Truck },
      { to: '/productos',   label: 'Productos',   icon: Package },
      { to: '/familias',    label: 'Familias',    icon: Boxes },
      { to: '/retenciones', label: 'Retenciones', icon: Percent, disabled: true },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { to: '/ventas',   label: 'Nueva Venta',   icon: ShoppingCart },
      { to: '/facturas', label: 'Listado Ventas', icon: FileText },
      { to: '/cartera',  label: 'Cartera',        icon: Wallet,       disabled: true },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/empresa',   label: 'Datos Empresa', icon: Building2 },
      { to: '/cajas',     label: 'Cajas',         icon: Calculator },
      { to: '/config',    label: 'Ajustes',       icon: Settings, disabled: true },
    ],
  },
];

export function AppLayout() {
  const nav = useNavigate();
  const { usuario, empresas, empresaActiva, switchEmpresa, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Sesión sin empresa activa (p.ej. token viejo de una empresa eliminada):
  // en vez de dejar la pantalla en blanco, mostramos una salida clara.
  if (!empresaActiva) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="text-lg font-semibold text-gray-800 mb-1">No hay una empresa activa</div>
        <div className="text-sm text-gray-500 mb-4 max-w-sm">
          Tu sesión no tiene una empresa asociada. Cierra sesión y vuelve a entrar.
        </div>
        <button
          onClick={logout}
          className="h-9 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  const trialDaysLeft = empresaActiva.trial_hasta
    ? Math.ceil((new Date(empresaActiva.trial_hasta).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* === Sidebar === */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center justify-between border-b">
          <button
            onClick={() => nav('/')}
            className="text-lg font-bold text-primary-700"
          >
            Conta FT Online
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {MENU.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((it) => {
                  const Icon = it.icon;
                  if (it.disabled) {
                    return (
                      <div
                        key={it.to}
                        title="Próximamente"
                        className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-gray-400 cursor-not-allowed"
                      >
                        <Icon size={16} />
                        <span className="flex-1">{it.label}</span>
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Próx.</span>
                      </div>
                    );
                  }
                  return (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2 py-2 rounded-md text-sm transition ${
                          isActive
                            ? 'bg-primary-50 text-primary-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                      end={it.to === '/'}
                    >
                      <Icon size={16} />
                      <span>{it.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Trial banner en sidebar */}
        {trialDaysLeft !== null && trialDaysLeft > 0 && !empresaActiva.suscripcion_hasta && (
          <div className="p-3 border-t bg-amber-50 border-amber-200">
            <div className="text-[10px] text-amber-700 uppercase tracking-widest">Trial activo</div>
            <div className="text-xs text-amber-900 font-semibold mt-0.5">
              {trialDaysLeft} día(s) restantes
            </div>
            <button className="mt-1 text-[11px] text-primary-600 hover:underline">
              Ver planes →
            </button>
          </div>
        )}
      </aside>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-20 bg-black/40"
        />
      )}

      {/* === Contenido === */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b h-14 sticky top-0 z-10 flex items-center gap-3 px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center"
          >
            <Menu size={20} />
          </button>

          {/* Selector de empresa */}
          {empresas.length > 1 ? (
            <div className="relative">
              <select
                value={empresaActiva.id}
                onChange={(e) => switchEmpresa(parseInt(e.target.value))}
                className="h-9 pl-2 pr-8 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.razon_social}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
              <Building2 size={15} className="text-primary-600" />
              <span>{empresaActiva.razon_social}</span>
              <span className="text-xs text-gray-400">· NIT {empresaActiva.nit}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Menú de usuario */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-sm"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-xs">
                {usuario?.nombre?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline">{usuario?.nombre}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  onClick={() => setUserMenuOpen(false)}
                  className="fixed inset-0 z-10"
                />
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <div className="px-3 py-2 border-b">
                    <div className="text-sm font-semibold">{usuario?.nombre}</div>
                    <div className="text-xs text-gray-500">{usuario?.email}</div>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); nav('/empresa'); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <User size={14} /> Perfil / Empresa
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main content — rutas hijas renderizan aquí */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
