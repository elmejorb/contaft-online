import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, showApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Registro de una empresa nueva + su usuario admin. Trial 14 días
 * automáticamente al terminar. Devuelve token que se aplica al AuthContext.
 */
export function SignupPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();

  const [form, setForm] = useState({
    razon_social: '',
    nit: '',
    email_contacto: '',
    telefono: '',
    nombre: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string }>('/landlord/signup', form);
      localStorage.setItem('token', data.token);
      await refresh();
      toast.success('¡Empresa registrada! Bienvenido a tu prueba de 14 días.');
      nav('/', { replace: true });
    } catch (err) {
      showApiError(err, 'No se pudo registrar la empresa');
    } finally {
      setLoading(false);
    }
  }

  const fld = (label: string, key: keyof typeof form, type = 'text', extra?: Record<string, unknown>) => (
    <label className="block">
      <span className="text-xs text-gray-600 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        required
        {...extra}
        className="mt-1 w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </label>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary-700">Conta FT Online</h1>
          <p className="text-sm text-gray-500 mt-1">Registra tu empresa · 14 días de prueba gratis</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket size={18} /> Crear cuenta
          </h2>

          <div className="border-b pb-2 mb-2 text-xs font-semibold text-gray-500 uppercase">Empresa</div>
          {fld('Razón social', 'razon_social')}
          <div className="grid grid-cols-2 gap-3">
            {fld('NIT (sin DV)', 'nit')}
            {fld('Teléfono', 'telefono')}
          </div>
          {fld('Email contacto empresa', 'email_contacto', 'email')}

          <div className="border-b pb-2 mb-2 mt-4 text-xs font-semibold text-gray-500 uppercase">Tu usuario admin</div>
          {fld('Tu nombre', 'nombre')}
          {fld('Tu email', 'email', 'email')}
          {fld('Contraseña (mín. 8)', 'password', 'password', { minLength: 8 })}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
          >
            {loading ? 'Creando…' : 'Crear cuenta y comenzar prueba'}
          </button>

          <div className="text-center text-sm text-gray-500 pt-2">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">
              Ingresa aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
