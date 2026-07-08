import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

/**
 * Cliente HTTP para la API de Conta FT Online.
 *
 * - En dev: apunta a http://localhost:8001/api (Laravel serve local).
 * - En prod: apunta a /api (misma origen — servido junto al build en Hostinger).
 *
 * Auth: token Sanctum en `localStorage['token']` como Bearer en cada request.
 * Si un 401 vuelve, borramos el token y forzamos redirect a /login.
 */

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8001/api' : '/api');

export const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: 'application/json' },
});

// Adjunta el Bearer token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Empresa activa (para usuarios con varias empresas). Opcional.
  const empresaId = localStorage.getItem('empresa_id');
  if (empresaId) config.headers['X-Empresa-Id'] = empresaId;

  return config;
});

// Manejo global de errores: 401 → logout automático
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ message?: string; error?: string; errors?: Record<string, string[]> }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      localStorage.removeItem('empresa_id');
      if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/signup')) {
        location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Muestra el mensaje de error de la API en un toast.
 * Cubre 422 (validación), 403 (permisos), 500 (server), y network.
 */
export function showApiError(err: unknown, fallback = 'Error inesperado') {
  const ax = err as AxiosError<{ message?: string; error?: string; errors?: Record<string, string[]> }>;
  const data = ax.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors)[0]?.[0];
    if (first) return toast.error(first, { duration: 6000 });
  }
  toast.error(data?.message || data?.error || ax.message || fallback, { duration: 6000 });
}
