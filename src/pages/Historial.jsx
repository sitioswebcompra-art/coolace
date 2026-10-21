import { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import { EmptyState, InlineMessage, PageTitle, StatusBadge, formatDate, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

export default function Historial() {
  const { data, isLoaded, dataError } = useData();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Todos');
  const [status, setStatus] = useState('Todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [technician, setTechnician] = useState('Todos');

  const timeline = useMemo(() => {
    const events = [];
    data.ordenes.forEach((order) => {
      const vehicle = data.vehiculos.find((item) => item.id === order.vehiculoId);
      const client = data.clientes.find((item) => item.id === order.clienteId);
      events.push({
        key: `orden-${order.id}`, date: order.updated_at || order.created_at || order.fecha,
        kind: 'Orden', entity: order.id, status: order.estado, service: order.servicio,
        client: client?.nombre || '', plate: vehicle?.patente || '', technician: order.tecnico || '',
        detail: `Orden ${order.id}: ${order.servicio}`,
      });
    });
    data.informes.forEach((report) => {
      const order = data.ordenes.find((item) => item.id === report.orden_id);
      const vehicle = data.vehiculos.find((item) => item.id === order?.vehiculoId);
      const client = data.clientes.find((item) => item.id === order?.clienteId);
      events.push({
        key: `informe-${report.id}`, date: report.updated_at || report.created_at,
        kind: 'Informe', entity: report.orden_id, status: report.estado, service: order?.servicio || '',
        client: client?.nombre || '', plate: vehicle?.patente || '', technician: order?.tecnico || '',
        detail: report.diagnostico || `Informe técnico ${report.estado?.toLowerCase() || ''}`,
      });
    });
    data.cotizaciones.forEach((quote) => {
      const vehicle = data.vehiculos.find((item) => item.id === quote.vehiculoId);
      const client = data.clientes.find((item) => item.id === quote.clienteId);
      const order = data.ordenes.find((item) => item.id === quote.orden_id);
      events.push({
        key: `quote-${quote.id}`, date: quote.updated_at || quote.created_at,
        kind: 'Cotización', entity: quote.numero, status: quote.estado, service: order?.servicio || '',
        client: client?.nombre || '', plate: vehicle?.patente || '', technician: order?.tecnico || '',
        detail: `Cotización ${quote.numero} · ${quote.total || 0}`,
      });
    });
    (data.activity || []).forEach((activity) => {
      const order = data.ordenes.find((item) => item.id === activity.orden_id);
      const vehicle = data.vehiculos.find((item) => item.id === activity.vehiculo_id);
      const client = data.clientes.find((item) => item.id === activity.cliente_id);
      events.push({
        key: `activity-${activity.id}`, date: activity.created_at,
        kind: 'Actividad', entity: activity.entidad_id || activity.entidad, status: activity.accion,
        service: order?.servicio || '', client: client?.nombre || '', plate: vehicle?.patente || '',
        technician: order?.tecnico || '', detail: activity.descripcion,
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const filtered = timeline.filter((event) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [event.entity, event.client, event.plate, event.service, event.technician, event.detail]
      .some((value) => value?.toLowerCase().includes(term));
    const parsedDate = event.date ? new Date(event.date) : null;
    const eventDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '';
    return matchesQuery &&
      (type === 'Todos' || event.kind === type) &&
      (status === 'Todos' || event.status === status) &&
      (technician === 'Todos' || event.technician === technician) &&
      (!from || eventDate >= from) && (!to || eventDate <= to);
  });

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando historial...</p>;
  return <div className="space-y-6">
    <PageTitle title="Historial y trazabilidad" description="Línea de tiempo de órdenes, informes y cotizaciones de clientes y vehículos."
      actions={<ExportActions title="Historial y trazabilidad" rows={filtered.map(({ date, kind, entity, status, client, plate, service, technician, detail }) => ({
        Fecha: date, Tipo: kind, Registro: entity, Estado: status, Cliente: client,
        Patente: plate, Servicio: service, Técnico: technician, Detalle: detail,
      }))} />} />
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="card grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className="relative sm:col-span-2"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${inputClass} pl-10`} placeholder="Patente, cliente, orden, cotización..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <select className={inputClass} value={type} onChange={(event) => setType(event.target.value)}><option>Todos</option><option>Orden</option><option>Informe</option><option>Cotización</option><option>Actividad</option></select>
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{[...new Set(timeline.map((event) => event.status).filter(Boolean))].map((state) => <option key={state}>{state}</option>)}</select>
      <select className={inputClass} value={technician} onChange={(event) => setTechnician(event.target.value)}><option>Todos</option>{[...new Set(timeline.map((event) => event.technician).filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</select>
      <input className={inputClass} type="date" aria-label="Desde" value={from} onChange={(event) => setFrom(event.target.value)} />
      <input className={inputClass} type="date" aria-label="Hasta" value={to} onChange={(event) => setTo(event.target.value)} />
    </section>
    {filtered.length ? <section className="card">
      <ol className="space-y-5">
        {filtered.map((event) => <li key={event.key} className="relative border-l-2 border-slate-200 pb-1 pl-5 last:border-transparent">
          <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand-electric ring-4 ring-white" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-semibold text-brand-dark">{event.detail}</p><p className="text-sm text-slate-500">{event.client} {event.plate && `· ${event.plate}`} {event.service && `· ${event.service}`}</p></div>
            <div className="flex items-center gap-2"><StatusBadge value={event.kind} /><StatusBadge value={event.status} /></div>
          </div>
          <p className="mt-1 text-xs text-slate-400">{formatDate(event.date)} {event.technician ? `· ${event.technician}` : ''}</p>
        </li>)}
      </ol>
    </section> : <EmptyState title="No hay eventos para esos filtros" detail="Ajusta la búsqueda o espera a que se registren nuevos movimientos." />}
    {!timeline.length && <p className="flex items-center gap-2 text-xs text-slate-400"><History size={14} /> La trazabilidad se construye a partir de órdenes, informes y cotizaciones.</p>}
  </div>;
}
