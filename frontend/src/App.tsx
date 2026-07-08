import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import type { JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { DashboardPage } from './pages/Dashboard';
import { DatosEmpresaPage } from './pages/DatosEmpresa';
import { ClientesPage } from './pages/Clientes';
import { ProductosPage } from './pages/Productos';
import { FamiliasPage } from './pages/Familias';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { usuario, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: 13 } }} />
        <Routes>
          {/* Públicas */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Autenticadas — envueltas en AppLayout (sidebar + header) */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/"           element={<DashboardPage />} />
            <Route path="/empresa"    element={<DatosEmpresaPage />} />
            <Route path="/clientes"   element={<ClientesPage />} />
            <Route path="/productos"  element={<ProductosPage />} />
            <Route path="/familias"   element={<FamiliasPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
