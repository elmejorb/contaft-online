import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { showApiError } from '../lib/api';
import { LoadingScreen } from '../components/LoadingScreen';

export function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Splash entre login exitoso y navegación al dashboard. Toma el hueco
  // de las 2 llamadas HTTP (/login + /me) y hace que la transición se
  // sienta intencional en vez de "pantalla congelada".
  const [redirecting, setRedirecting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Mostramos el splash apenas empieza el login — así el POST /login
      // + GET /me quedan cubiertos con la animación.
      setRedirecting(true);
      await login(email, password);
      // Pequeño delay para que el usuario alcance a leer "Bienvenido…"
      await new Promise((r) => setTimeout(r, 350));
      nav('/', { replace: true });
    } catch (err) {
      setRedirecting(false);
      showApiError(err, 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  if (redirecting) {
    return (
      <LoadingScreen
        cyclingMessages={[
          'Verificando credenciales…',
          'Cargando tu empresa…',
          'Preparando el panel…',
          '¡Bienvenido!',
        ]}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary-700">Conta FT Online</h1>
          <p className="text-sm text-gray-500 mt-1">Facturación electrónica para tu negocio</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LogIn size={18} /> Iniciar sesión
          </h2>

          <label className="block">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <div className="text-center text-sm text-gray-500 pt-2">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/signup" className="text-primary-600 hover:underline font-medium">
              Registra tu empresa
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
