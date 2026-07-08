import { useEffect, useState } from 'react';
import { LogOut, Building2, User, Calendar, Package, Users, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

/**
 * Dashboard mínimo — muestra la empresa activa + KPIs básicos.
 * Se irá ampliando con los módulos (ventas, cartera, etc.) en fases futuras.
 */
export function DashboardPage() {
  const { usuario, empresaActiva, empresas, switchEmpresa, logout } = useAuth();
  const [clientes, setClientes] = useState<number | null>(null);
  const [productos, setProductos] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaActiva) return;
    // Carga counts en paralelo — endpoints paginan y devuelven `.total`
    api.get('/clientes?per_page=1').then(r => setClientes(r.data.total)).catch(() => setClientes(0));
    api.get('/productos?per_page=1').then(r => setProductos(r.data.total)).catch(() => setProductos(0));
  }, [empresaActiva]);

  if (!empresaActiva) {
    return <div className="p-8 text-gray-500">Sin empresa activa</div>;
  }

  const trialDaysLeft = empresaActiva.trial_hasta
    ? Math.ceil((new Date(empresaActiva.trial_hasta).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="font-bold text-primary-700">Conta FT Online</div>
          <div className="flex-1" />

          {empresas.length > 1 ? (
            <select
              value={empresaActiva.id}
              onChange={(e) => switchEmpresa(parseInt(e.target.value))}
              className="h-8 px-2 border border-gray-300 rounded text-sm"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.razon_social}</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-700 flex items-center gap-1">
              <Building2 size={14} /> {empresaActiva.razon_social}
            </div>
          )}

          <div className="text-sm text-gray-500 flex items-center gap-1 border-l pl-3">
            <User size={14} /> {usuario?.nombre}
          </div>

          <button
            onClick={logout}
            title="Cerrar sesión"
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Trial banner */}
        {trialDaysLeft !== null && trialDaysLeft > 0 && !empresaActiva.suscripcion_hasta && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-800">
            <Calendar size={16} />
            <div className="flex-1 text-sm">
              <b>Trial activo</b> — te quedan <b>{trialDaysLeft} día(s)</b> de tu prueba gratuita.
              {' '}Plan: <b>{empresaActiva.plan?.nombre}</b>.
            </div>
            <button className="text-amber-900 font-semibold text-sm underline hover:no-underline">
              Ver planes
            </button>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">Panel principal</h1>
          <p className="text-sm text-gray-500 mt-1">
            {empresaActiva.razon_social} · NIT {empresaActiva.nit}
          </p>
        </div>

        {/* KPI tiles — placeholders hasta que existan Ventas/Cartera */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiTile icon={Users}   label="Clientes"  value={clientes} to="/clientes" />
          <KpiTile icon={Package} label="Productos" value={productos} to="/productos" />
          <KpiTile icon={Settings} label="Configuración" value={null} to="/config" />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          <div className="text-sm">
            Módulos por venir: ventas, cartera, kardex, facturación electrónica, informes.
          </div>
          <div className="text-xs mt-2 text-gray-400">
            Este panel es la vista mínima de la Fase 2 — se irá ampliando por hito.
          </div>
        </div>
      </main>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Users;
  label: string;
  value: number | null;
  to: string;
}) {
  return (
    <a href={to} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow transition block">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500 tracking-wide">{label}</div>
          <div className="text-2xl font-bold mt-1">
            {value === null ? '…' : value.toLocaleString('es-CO')}
          </div>
        </div>
      </div>
    </a>
  );
}
