import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import type { JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { InicioPage } from './pages/Inicio';
import { DatosEmpresaPage } from './pages/DatosEmpresa';
import { ClientesPage } from './pages/Clientes';
import { ProductosPage } from './pages/Productos';
import { FamiliasPage } from './pages/Familias';
import { ProveedoresPage } from './pages/Proveedores';
import { VentasPage } from './pages/Ventas';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { usuario, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <LoadingScreen message="Restaurando sesión…" />;
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

          {/* Home / pantalla de inicio — pantalla completa, sin AppLayout */}
          <Route
            path="/"
            element={<RequireAuth><InicioPage /></RequireAuth>}
          />

          {/* Módulos — dentro del AppLayout (sidebar + header) */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/empresa"     element={<DatosEmpresaPage />} />
            <Route path="/clientes"    element={<ClientesPage />} />
            <Route path="/proveedores" element={<ProveedoresPage />} />
            <Route path="/productos"   element={<ProductosPage />} />
            <Route path="/familias"    element={<FamiliasPage />} />
            <Route path="/ventas"      element={<VentasPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
