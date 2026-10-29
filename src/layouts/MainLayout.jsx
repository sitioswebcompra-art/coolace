import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  BarChart3, Bell, Building2, CalendarDays, ClipboardCheck, FileText, History,
  Archive, LayoutDashboard, LogOut, Menu, Package, Truck, UserCircle, UserCog, Users, Wrench, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatDate } from '../components/ui';

const navigation = [
  { name: 'Panel principal', icon: LayoutDashboard, path: '/', roles: ['Administrador', 'Supervisor', 'Técnico', 'Área administrativa', 'Cliente'] },
  { name: 'Clientes', icon: Users, path: '/clientes', roles: ['Administrador', 'Supervisor', 'Área administrativa'] },
  { name: 'Vehículos', icon: Truck, path: '/vehiculos', roles: ['Administrador', 'Supervisor', 'Técnico', 'Cliente'] },
  { name: 'Agenda y órdenes', icon: CalendarDays, path: '/agenda', roles: ['Administrador', 'Supervisor', 'Técnico'] },
  { name: 'Técnicos', icon: Wrench, path: '/tecnicos', roles: ['Administrador', 'Supervisor'] },
  { name: 'Informes técnicos', icon: ClipboardCheck, path: '/informes', roles: ['Administrador', 'Supervisor', 'Técnico'] },
  { name: 'Cotizaciones', icon: FileText, path: '/cotizaciones', roles: ['Administrador', 'Supervisor', 'Área administrativa', 'Cliente'] },
  { name: 'Repuestos e inventario', icon: Package, path: '/inventario', roles: ['Administrador', 'Supervisor', 'Área administrativa'] },
  { name: 'Historial', icon: History, path: '/historial', roles: ['Administrador', 'Supervisor', 'Técnico', 'Área administrativa', 'Cliente'] },
  { name: 'Reportes e indicadores', icon: BarChart3, path: '/reportes', roles: ['Administrador', 'Supervisor', 'Área administrativa'] },
  { name: 'Configuración', icon: Building2, path: '/configuracion', roles: ['Administrador'] },
  { name: 'Usuarios y roles', icon: UserCog, path: '/usuarios', roles: ['Administrador'] },
  { name: 'Papelera', icon: Archive, path: '/papelera', roles: ['Administrador'] },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const location = useLocation();
  const { user, logout } = useAuth();
  const { data, markNotificationRead } = useData();
  const menuItems = navigation.filter((item) => item.roles.includes(user?.role));
  const unread = data.notificaciones.filter((item) => !item.leida).length;

  const closeNavigation = () => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
  };
  const signOut = async () => {
    setLogoutError('');
    const result = await logout();
    if (!result?.success) setLogoutError(result?.message || 'No se pudo cerrar la sesión.');
  };
  const openNotification = async (notification) => {
    if (!notification.leida) {
      try { await markNotificationRead(notification.id); }
      catch (error) { setLogoutError(error.message); }
    }
    setNotificationsOpen(false);
  };

  return (
    <div className="app-shell flex min-h-screen bg-brand-light">
      {sidebarOpen && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-20 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-brand-dark text-white transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-700 px-5">
          <Link to="/" onClick={closeNavigation} className="flex items-center gap-2 text-lg font-bold"><span className="text-brand-electric">❄</span> CoolAceGest</Link>
          <button className="rounded p-2 text-slate-300 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <Link to="/perfil" onClick={closeNavigation} className="flex items-center gap-3 border-b border-slate-700 p-4 hover:bg-slate-800">
          <UserCircle size={38} className="shrink-0 text-slate-400" />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-brand-electric">{user?.role}</p></div>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/' ? location.pathname === '/' : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return <Link key={item.path} to={item.path} onClick={closeNavigation} aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-brand-blue text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <Icon size={18} /><span>{item.name}</span>
            </Link>;
          })}
        </nav>
        <div className="shrink-0 border-t border-slate-700 p-3">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10"><LogOut size={18} />Cerrar sesión</button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Abrir menú"><Menu size={22} /></button>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">{user?.name} · {user?.role}</p>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/perfil" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Mi perfil"><UserCircle size={20} /></Link>
            <div className="relative">
              <button onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notificaciones (${unread} sin leer)`}>
                <Bell size={20} />
                {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
              </button>
              {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(92vw,24rem)] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
                <div className="flex items-center justify-between px-2 pb-2"><h3 className="font-bold">Notificaciones</h3><span className="text-xs text-slate-500">{unread} sin leer</span></div>
                <div className="max-h-[65vh] space-y-1 overflow-y-auto">
                  {data.notificaciones.length ? data.notificaciones.map((notification) => <Link key={notification.id} to={notification.enlace || '/'} onClick={() => openNotification(notification)}
                    className={`block rounded-lg p-3 hover:bg-slate-50 ${notification.leida ? '' : 'bg-blue-50/70'}`}>
                    <p className="text-sm font-semibold">{notification.titulo}</p><p className="mt-1 text-xs text-slate-600">{notification.mensaje}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(notification.created_at)}</p>
                  </Link>) : <p className="p-4 text-center text-sm text-slate-500">No tienes notificaciones.</p>}
                </div>
              </div>}
            </div>
            <button onClick={signOut} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:flex"><LogOut size={17} />Salir</button>
          </div>
        </header>
        {logoutError && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{logoutError}</p>}
        <div className="flex-1 p-4 sm:p-6 xl:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
