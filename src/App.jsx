import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Vehiculos = lazy(() => import('./pages/Vehiculos'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Tecnicos = lazy(() => import('./pages/Tecnicos'));
const Informes = lazy(() => import('./pages/Informes'));
const Cotizaciones = lazy(() => import('./pages/Cotizaciones'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Historial = lazy(() => import('./pages/Historial'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Papelera = lazy(() => import('./pages/Papelera'));
const AccesoDenegado = lazy(() => import('./pages/AccesoDenegado'));

const allowedRoles = {
  clientes: ['Administrador', 'Supervisor', 'Área administrativa'],
  vehiculos: ['Administrador', 'Supervisor', 'Técnico', 'Cliente'],
  agenda: ['Administrador', 'Supervisor', 'Técnico'],
  tecnicos: ['Administrador', 'Supervisor'],
  informes: ['Administrador', 'Supervisor', 'Técnico'],
  cotizaciones: ['Administrador', 'Supervisor', 'Área administrativa', 'Cliente'],
  inventario: ['Administrador', 'Supervisor', 'Área administrativa'],
  historial: ['Administrador', 'Supervisor', 'Técnico', 'Área administrativa', 'Cliente'],
  reportes: ['Administrador', 'Supervisor', 'Área administrativa'],
  configuracion: ['Administrador'],
  usuarios: ['Administrador'],
};

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/acceso-denegado" replace />;
  return children;
}

function LoadingPage() {
  return <div className="p-8 text-center text-sm text-slate-500">Cargando módulo...</div>;
}

export default function App() {
  const { user, passwordRecovery } = useAuth();
  return <Router>
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={passwordRecovery ? <Navigate to="/perfil" replace /> : <Dashboard />} />
          <Route path="clientes" element={<ProtectedRoute roles={allowedRoles.clientes}><Clientes /></ProtectedRoute>} />
          <Route path="vehiculos" element={<ProtectedRoute roles={allowedRoles.vehiculos}><Vehiculos /></ProtectedRoute>} />
          <Route path="agenda" element={<ProtectedRoute roles={allowedRoles.agenda}><Agenda /></ProtectedRoute>} />
          <Route path="tecnicos" element={<ProtectedRoute roles={allowedRoles.tecnicos}><Tecnicos /></ProtectedRoute>} />
          <Route path="informes" element={<ProtectedRoute roles={allowedRoles.informes}><Informes /></ProtectedRoute>} />
          <Route path="cotizaciones" element={<ProtectedRoute roles={allowedRoles.cotizaciones}><Cotizaciones /></ProtectedRoute>} />
          <Route path="inventario" element={<ProtectedRoute roles={allowedRoles.inventario}><Inventario /></ProtectedRoute>} />
          <Route path="historial" element={<ProtectedRoute roles={allowedRoles.historial}><Historial /></ProtectedRoute>} />
          <Route path="reportes" element={<ProtectedRoute roles={allowedRoles.reportes}><Reportes /></ProtectedRoute>} />
          <Route path="configuracion" element={<ProtectedRoute roles={allowedRoles.configuracion}><Configuracion /></ProtectedRoute>} />
          <Route path="usuarios" element={<ProtectedRoute roles={allowedRoles.usuarios}><Usuarios /></ProtectedRoute>} />
          <Route path="papelera" element={<ProtectedRoute roles={allowedRoles.configuracion}><Papelera /></ProtectedRoute>} />
          <Route path="perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="acceso-denegado" element={<AccesoDenegado />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  </Router>;
}
