import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
}

export interface Empresa {
  id: number;
  razon_social: string;
  nit: string;
  rol: 'admin' | 'contador' | 'vendedor' | 'bodega' | 'solo_lectura';
  default: boolean;
  activa: boolean;
  trial_hasta?: string | null;
  suscripcion_hasta?: string | null;
  plan?: { nombre: string; slug: string; features?: Record<string, unknown> };
}

interface AuthState {
  usuario: Usuario | null;
  empresas: Empresa[];
  empresaActiva: Empresa | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchEmpresa: (id: number) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Guarda usuario + empresas en localStorage y state. Sanctum token vive
 * también en localStorage para que el interceptor de axios lo adjunte.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaActiva, setEmpresaActiva] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaurar sesión al montar
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    refresh().catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const { data } = await api.get<{ usuario: Usuario; empresas: Empresa[] }>('/landlord/me');
    setUsuario(data.usuario);
    setEmpresas(data.empresas);
    // Empresa activa: la guardada en localStorage o la default
    const activaId = parseInt(localStorage.getItem('empresa_id') || '0');
    const activa = data.empresas.find((e) => e.id === activaId)
      || data.empresas.find((e) => e.default)
      || data.empresas[0];
    if (activa) {
      setEmpresaActiva(activa);
      localStorage.setItem('empresa_id', String(activa.id));
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<{ token: string; usuario: Usuario; empresas: Empresa[] }>('/landlord/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    setEmpresas(data.empresas);
    const def = data.empresas.find((e) => e.default) || data.empresas[0];
    if (def) {
      setEmpresaActiva(def);
      localStorage.setItem('empresa_id', String(def.id));
    }
    // Recargar `me` para traer trial/suscripción/plan completos
    await refresh();
  }

  async function logout() {
    try { await api.delete('/landlord/logout'); } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresa_id');
    setUsuario(null);
    setEmpresas([]);
    setEmpresaActiva(null);
    location.href = '/login';
  }

  function switchEmpresa(id: number) {
    const e = empresas.find((x) => x.id === id);
    if (e) {
      setEmpresaActiva(e);
      localStorage.setItem('empresa_id', String(id));
      location.reload();
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, empresas, empresaActiva, loading, login, logout, switchEmpresa, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
