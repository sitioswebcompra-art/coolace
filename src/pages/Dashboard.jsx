import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock3, FileText, Truck, Users, Wrench, RefreshCw, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { EmptyState, PageTitle, StatusBadge, formatDate } from '../components/ui';
import ExportActions from '../components/ExportActions';

const today = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoaded, dataError, refreshData } = useData();
  const isClient = user?.role === 'Cliente';
  const isTechnician = user?.role === 'Técnico';

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando datos del sistema...</p>;

  const activeOrders = data.ordenes.filter((order) => !['Completado', 'Cancelado'].includes(order.estado));
  const todayOrders = data.ordenes.filter((order) => order.fecha === today);
  const pendingQuotes = data.cotizaciones.filter((quote) => ['Borrador', 'Enviada', 'Vista'].includes(quote.estado));
  const cards = [
    { label: 'Trabajos pendientes', value: activeOrders.filter((order) => ['Pendiente', 'Asignado', 'Confirmado'].includes(order.estado)).length, icon: Clock3, color: 'text-amber-600 bg-amber-50', link: '/agenda' },
    { label: 'Agenda de hoy', value: todayOrders.length, icon: CalendarDays, color: 'text-blue-600 bg-blue-50', link: '/agenda' },
    { label: 'En proceso', value: data.ordenes.filter((order) => order.estado === 'En proceso').length, icon: Wrench, color: 'text-orange-600 bg-orange-50', link: '/agenda' },
    { label: 'Cotizaciones por responder', value: pendingQuotes.length, icon: FileText, color: 'text-violet-600 bg-violet-50', link: '/cotizaciones' },
    { label: 'Clientes activos', value: data.clientes.filter((client) => client.estado === 'Activo').length, icon: Users, color: 'text-cyan-700 bg-cyan-50', link: '/clientes' },
    { label: 'Vehículos registrados', value: data.vehiculos.length, icon: Truck, color: 'text-indigo-700 bg-indigo-50', link: '/vehiculos' },
    { label: 'Trabajos completados', value: data.ordenes.filter((order) => order.estado === 'Completado').length, icon: CheckCircle2, color: 'text-green-700 bg-green-50', link: '/historial' },
    { label: 'Informes técnicos', value: data.informes.length, icon: FileText, color: 'text-slate-700 bg-slate-100', link: '/informes' },
  ].filter((card) => {
    if (isClient) return ['Vehículos registrados', 'Cotizaciones por responder', 'Trabajos completados'].includes(card.label);
    if (isTechnician) return !['Clientes activos', 'Cotizaciones por responder'].includes(card.label);
    return true;
  });
  const quickActions = isClient || isTechnician ? [] : [
    { title: 'Registrar cliente', detail: 'Ficha comercial y de contacto', icon: Users, link: '/clientes' },
    { title: 'Agregar vehículo', detail: 'Datos del vehículo y del equipo', icon: Truck, link: '/vehiculos' },
    ...(user?.role === 'Administrador' || user?.role === 'Supervisor'
      ? [{ title: 'Crear orden de trabajo', detail: 'Agendar y asignar un servicio', icon: CalendarDays, link: '/agenda' }]
      : []),
  ];

  const clientName = (id) => data.clientes.find((client) => client.id === id)?.nombre || 'Cliente no disponible';

  return (
    <div className="space-y-6">
      <PageTitle title="Panel de operaciones" description={`Hola ${user?.name || ''}. Resumen actualizado de tu operación.`}
        actions={<><ExportActions title="Panel de operaciones" summary={[
          { Indicador: 'Fecha de generación', Valor: today },
          { Indicador: 'Clientes activos', Valor: data.clientes.filter((client) => client.estado === 'Activo').length },
          { Indicador: 'Vehículos registrados', Valor: data.vehiculos.length },
          { Indicador: 'Órdenes registradas', Valor: data.ordenes.length },
          { Indicador: 'Órdenes programadas para hoy', Valor: todayOrders.length },
          { Indicador: 'Órdenes activas', Valor: activeOrders.length },
          { Indicador: 'Cotizaciones por responder', Valor: pendingQuotes.length },
          { Indicador: 'Informes técnicos', Valor: data.informes.length },
        ]} rows={data.ordenes.map((order) => ({
          Orden: order.id, Fecha: order.fecha, Servicio: order.servicio, Estado: order.estado,
          Cliente: clientName(order.clienteId),
          Patente: data.vehiculos.find((vehicle) => vehicle.id === order.vehiculoId)?.patente || '',
          Técnico: order.tecnico || '',
        }))} /><button onClick={refreshData} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /> Actualizar</button></>} />
      {dataError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">No se pudieron cargar todos los datos</p><p className="mt-1">{dataError}</p>
      </div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card flex items-center justify-between gap-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-brand-dark">{value}</p></div>
            <span className={`rounded-xl p-3 ${color}`}><Icon size={23} /></span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="font-bold text-brand-dark">Agenda del día</h3><p className="text-sm text-slate-500">{formatDate(today)}</p></div>
            <Link to={isClient ? '/historial' : '/agenda'} className="flex items-center gap-1 text-sm font-semibold text-brand-blue">{isClient ? 'Ver historial' : 'Ver agenda'} <ArrowUpRight size={16} /></Link>
          </div>
          {todayOrders.length ? <div className="divide-y">
            {todayOrders.slice(0, 6).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="font-semibold text-brand-dark">{order.id} · {order.servicio}</p>
                <p className="text-sm text-slate-500">{clientName(order.clienteId)} · {order.tecnico || 'Sin asignar'}</p></div>
              <StatusBadge value={order.estado} />
            </div>)}
          </div> : <EmptyState title="No hay trabajos programados para hoy" detail="Las nuevas órdenes aparecerán en esta lista." />}
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <div><h3 className="font-bold text-brand-dark">Órdenes recientes</h3><p className="text-sm text-slate-500">Últimos movimientos</p></div>
            <Link to="/historial" className="text-sm font-semibold text-brand-blue">Historial</Link>
          </div>
          {data.ordenes.length ? <div className="space-y-3">
            {data.ordenes.slice(0, 5).map((order) => <div key={order.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3">
              <div><p className="font-semibold text-brand-blue">{order.id}</p><p className="text-sm text-slate-600">{order.servicio} · {clientName(order.clienteId)}</p></div>
              <StatusBadge value={order.estado} />
            </div>)}
          </div> : <EmptyState title="Aún no hay órdenes" detail="Crea una orden desde Agenda cuando tengas un vehículo registrado." />}
        </section>
      </div>

      {quickActions.length > 0 && <section className="grid gap-4 md:grid-cols-3">
        {quickActions.map(({ title, detail, icon: Icon, link }) => <Link key={title} to={link} className="card flex items-center justify-between hover:border-brand-electric"><div><p className="font-bold">{title}</p><p className="text-sm text-slate-500">{detail}</p></div><Icon className="text-brand-blue" /></Link>)}
      </section>}
    </div>
  );
}
