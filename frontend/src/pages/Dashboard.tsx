import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, Boxes, ArrowRight, TrendingUp, ShoppingCart, FileText, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Card } from '../components/ui';

/**
 * Página de inicio (overview). Muestra KPIs generales de la empresa
 * activa y accesos rápidos a los módulos.
 */
export function DashboardPage() {
  const { usuario, empresaActiva } = useAuth();
  const [clientes, setClientes] = useState<number | null>(null);
  const [productos, setProductos] = useState<number | null>(null);
  const [familias, setFamilias] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaActiva) return;
    api.get('/clientes?per_page=1').then(r => setClientes(r.data.total)).catch(() => setClientes(0));
    api.get('/productos?per_page=1').then(r => setProductos(r.data.total)).catch(() => setProductos(0));
    api.get('/familias').then(r => setFamilias(r.data.familias?.length ?? 0)).catch(() => setFamilias(0));
  }, [empresaActiva]);

  if (!empresaActiva) return null;

  return (
    <div className="p-6">
      <PageHeader
        title={`Hola, ${usuario?.nombre?.split(' ')[0] ?? ''}`}
        subtitle={`Panel de ${empresaActiva.razon_social}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiTile label="Clientes"   value={clientes}  icon={Users}   to="/clientes"  color="blue" />
        <KpiTile label="Productos"  value={productos} icon={Package} to="/productos" color="green" />
        <KpiTile label="Familias"   value={familias}  icon={Boxes}   to="/familias"  color="amber" />
        <KpiTile label="Ventas hoy" value={null}      icon={TrendingUp} to="/ventas"  color="violet" disabled />
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Configuración inicial</h3>
          <p className="text-sm text-gray-600 mb-4">
            Antes de empezar a facturar, completa estos datos:
          </p>
          <ol className="space-y-2 text-sm">
            <ChecklistItem label="Datos de tu empresa" to="/empresa" />
            <ChecklistItem label="Crea tus clientes"   to="/clientes" />
            <ChecklistItem label="Carga tus productos" to="/productos" />
            <ChecklistItem label="Organiza en familias (opcional)" to="/familias" />
          </ol>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Próximos módulos</h3>
          <p className="text-sm text-gray-600 mb-4">
            En desarrollo — llegarán en las próximas versiones:
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <PendingItem label="Nueva Venta (POS)" icon={ShoppingCart} />
            <PendingItem label="Facturación Electrónica DIAN" icon={FileText} />
            <PendingItem label="Cartera y pagos" icon={Wallet} />
            <PendingItem label="Informes contables" icon={TrendingUp} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------- Sub-componentes ----------------
type Color = 'blue' | 'green' | 'amber' | 'violet';
const colorClasses: Record<Color, string> = {
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-700',
  amber:  'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
};

function KpiTile({
  label, value, icon: Icon, to, color, disabled,
}: {
  label: string;
  value: number | null;
  icon: typeof Users;
  to: string;
  color: Color;
  disabled?: boolean;
}) {
  const body = (
    <Card className={`p-5 h-full transition ${disabled ? 'opacity-60' : 'hover:border-primary-300 hover:shadow-sm'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase text-gray-500 tracking-widest font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-0.5">
            {value === null ? (disabled ? '—' : '…') : value.toLocaleString('es-CO')}
          </div>
        </div>
      </div>
    </Card>
  );
  return disabled ? body : <Link to={to} className="block">{body}</Link>;
}

function ChecklistItem({ label, to }: { label: string; to: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-primary-500" />
        <span className="flex-1">{label}</span>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-primary-600" />
      </Link>
    </li>
  );
}

function PendingItem({ label, icon: Icon }: { label: string; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon size={14} className="text-gray-400" />
      <span>{label}</span>
      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-auto">Próx.</span>
    </div>
  );
}
