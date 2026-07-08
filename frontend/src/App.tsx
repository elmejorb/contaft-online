import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { DashboardPage } from './pages/Dashboard';
import type { JSX } from 'react';

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
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          {/* Rutas futuras: /clientes, /productos, /ventas, /cartera, ... */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
