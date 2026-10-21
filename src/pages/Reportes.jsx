import { useMemo, useState } from 'react';
import { BarChart3, FileCheck2, Timer, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { EmptyState, InlineMessage, PageTitle, formatDate, formatMoney, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

export default function Reportes() {
  const { data, isLoaded, dataError } = useData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filteredOrders = useMemo(() => data.ordenes.filter((order) => (!from || order.fecha >= from) && (!to || order.fecha <= to)), [data.ordenes, from, to]);
  const includedIds = new Set(filteredOrders.map((order) => order.id));
  const quotes = data.cotizaciones.filter((quote) => includedIds.has(quote.orden_id));
  const approved = quotes.filter((quote) => ['Aprobada', 'Convertida'].includes(quote.estado));
  const conversion = quotes.length ? Math.round(approved.length / quotes.length * 100) : 0;
  const revenue = approved.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
  const avgMinutes = data.informes.filter((report) => includedIds.has(report.orden_id) && report.llegada && report.termino)
    .reduce((sum, report) => sum + (new Date(report.termino) - new Date(report.llegada)) / 60000, 0);
  const avgCount = data.informes.filter((report) => includedIds.has(report.orden_id) && report.llegada && report.termino).length;
  const averageTime = avgCount ? Math.round(avgMinutes / avgCount) : 0;

  const byTechnician = Object.entries(filteredOrders.reduce((counts, order) => {
    const name = order.tecnico || 'Sin asignar';
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  const byService = Object.entries(filteredOrders.reduce((counts, order) => {
    counts[order.servicio] = (counts[order.servicio] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  const failureCounts = Object.entries(data.informes.filter((report) => includedIds.has(report.orden_id)).flatMap((report) => report.fallas || [])
    .reduce((counts, failure) => { counts[failure] = (counts[failure] || 0) + 1; return counts; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const upcomingMaintenance = data.vehiculos.filter((vehicle) => vehicle.proximo_mantenimiento && vehicle.proximo_mantenimiento >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.proximo_mantenimiento.localeCompare(b.proximo_mantenimiento)).slice(0, 8);

  if (!isLoaded && !dataError) return <p className="text-slate-500">Calculando indicadores...</p>;
  return <div className="space-y-6">
    <PageTitle title="Reportes e indicadores" description="Rendimiento operativo, conversión comercial y mantenimientos próximos."
      actions={<ExportActions title="Reportes e indicadores" rows={filteredOrders.map((order) => ({
        Orden: order.id, Fecha: order.fecha, Servicio: order.servicio, Estado: order.estado,
        Cliente: data.clientes.find((client) => client.id === order.clienteId)?.nombre || '',
        Patente: data.vehiculos.find((vehicle) => vehicle.id === order.vehiculoId)?.patente || '',
        Técnico: order.tecnico || '', Prioridad: order.prioridad, Zona: order.zona,
        'Cotización asociada': quotes.find((quote) => quote.orden_id === order.id)?.numero || '',
      }))} summary={[
        { Indicador: 'Período desde', Valor: from || 'Sin límite' },
        { Indicador: 'Período hasta', Valor: to || 'Sin límite' },
        { Indicador: 'Servicios registrados', Valor: filteredOrders.length },
        { Indicador: 'Cotizaciones', Valor: quotes.length },
        { Indicador: 'Conversión aprobada', Valor: `${conversion}%` },
        { Indicador: 'Ingresos cotizados aprobados', Valor: revenue },
        { Indicador: 'Tiempo promedio de atención (min)', Valor: averageTime },
        ...failureCounts.map(([name, count]) => ({ Indicador: `Falla frecuente: ${name}`, Valor: count })),
      ]} />} />
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="card grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-600">Desde<input className={`${inputClass} mt-1`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="text-sm font-medium text-slate-600">Hasta<input className={`${inputClass} mt-1`} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Servicios registrados', value: filteredOrders.length, icon: BarChart3 },
        { label: 'Cotizaciones enviadas', value: quotes.length, icon: FileCheck2 },
        { label: 'Conversión aprobada', value: `${conversion}%`, icon: TrendingUp },
        { label: 'Ingresos cotizados aprobados', value: formatMoney(revenue), icon: Timer },
      ].map(({ label, value, icon: Icon }) => <article key={label} className="card flex items-center justify-between gap-4"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-brand-dark">{value}</p></div><Icon className="text-brand-electric" size={25} /></article>)}
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card"><h3 className="mb-4 font-bold">Servicios por técnico</h3>
        {byTechnician.length ? <div className="space-y-3">{byTechnician.map(([name, count]) => <div key={name}>
          <div className="mb-1 flex justify-between text-sm"><span>{name}</span><strong>{count}</strong></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-electric" style={{ width: `${Math.max(4, count / filteredOrders.length * 100)}%` }} /></div>
        </div>)}</div> : <EmptyState title="Sin órdenes para el período" />}</section>
      <section className="card"><h3 className="mb-4 font-bold">Servicios por tipo</h3>
        {byService.length ? <div className="space-y-3">{byService.map(([name, count]) => <div key={name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{name}</span><strong>{count}</strong></div>)}</div> : <EmptyState title="Sin datos" />}</section>
      <section className="card"><h3 className="mb-4 font-bold">Fallas más frecuentes</h3>
        {failureCounts.length ? <div className="space-y-3">{failureCounts.map(([name, count]) => <div key={name} className="flex justify-between border-b pb-2 text-sm"><span>{name}</span><strong>{count}</strong></div>)}</div> : <EmptyState title="Aún no hay fallas informadas" detail="Las fallas se agregan al completar informes técnicos." />}</section>
      <section className="card"><h3 className="mb-4 font-bold">Mantenimientos próximos</h3>
        {upcomingMaintenance.length ? <div className="space-y-3">{upcomingMaintenance.map((vehicle) => <div key={vehicle.id} className="flex justify-between gap-3 border-b pb-2 text-sm">
          <span className="font-semibold">{vehicle.patente} · {data.clientes.find((client) => client.id === vehicle.clienteId)?.nombre || 'Cliente'}</span><span>{formatDate(vehicle.proximo_mantenimiento)}</span>
        </div>)}</div> : <EmptyState title="No hay mantenimientos programados" detail="Agrega una fecha de próximo mantenimiento en la ficha del vehículo." />}</section>
    </div>
    <section className="card"><h3 className="mb-2 font-bold">Tiempo promedio de atención</h3>
      <p className="text-sm text-slate-500">Calculado desde la llegada hasta el término registrado en los informes del período.</p>
      <p className="mt-3 text-3xl font-bold text-brand-dark">{averageTime ? `${Math.floor(averageTime / 60)} h ${averageTime % 60} min` : 'Sin datos suficientes'}</p>
    </section>
  </div>;
}
