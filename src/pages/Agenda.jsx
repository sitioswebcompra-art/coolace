import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ArchiveButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, formatDate, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const serviceTypes = ['Mantenimiento preventivo', 'Diagnóstico de falla', 'Reparación', 'Instalación', 'Inspección', 'Recarga de refrigerante', 'Emergencia', 'Otro servicio'];
const statuses = ['Pendiente', 'Asignado', 'Confirmado', 'En proceso', 'Esperando repuestos', 'Completado', 'Cancelado', 'Reprogramado'];
const currentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function Agenda() {
  const { user } = useAuth();
  const { data, addOrden, updateOrdenEstado, updateOrden, archiveRecord, isLoaded, dataError } = useData();
  const isTechnician = user?.role === 'Técnico';
  const isAdmin = user?.role === 'Administrador';
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [technicianFilter, setTechnicianFilter] = useState('Todos');
  const [zoneFilter, setZoneFilter] = useState('Todas');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [selectedDate, setSelectedDate] = useState(currentDate());
  const [period, setPeriod] = useState('mes');
  const [form, setForm] = useState({
    vehiculoId: '', servicio: '', fecha: currentDate(), hora_inicio: '', tecnico_id: '',
    prioridad: 'Normal', estado: 'Pendiente', zona: '', direccion: '', duracion_estimada: '60', descripcion: '', observaciones: '',
  });

  const dateRange = useMemo(() => {
    const pivot = new Date(`${selectedDate}T12:00:00`);
    let start = new Date(pivot);
    let end = new Date(pivot);
    if (period === 'semana') {
      const day = (pivot.getDay() + 6) % 7;
      start.setDate(pivot.getDate() - day);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (period === 'mes') {
      start = new Date(pivot.getFullYear(), pivot.getMonth(), 1);
      end = new Date(pivot.getFullYear(), pivot.getMonth() + 1, 0);
    }
    const format = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return { start: format(start), end: format(end) };
  }, [period, selectedDate]);

  const orders = useMemo(() => data.ordenes.filter((order) => !order.archived_at).filter((order) => {
    const client = data.clientes.find((item) => item.id === order.clienteId);
    const vehicle = data.vehiculos.find((item) => item.id === order.vehiculoId);
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [order.id, order.servicio, client?.nombre, vehicle?.patente, order.tecnico]
      .some((value) => value?.toLowerCase().includes(term));
    const matchesRange = order.fecha >= dateRange.start && order.fecha <= dateRange.end;
    const matchesStatus = statusFilter === 'Todos' || order.estado === statusFilter;
    const matchesTechnician = technicianFilter === 'Todos' || String(order.tecnico_id || '') === technicianFilter;
    const matchesZone = zoneFilter === 'Todas' || (order.zona || 'Sin zona') === zoneFilter;
    const matchesPriority = priorityFilter === 'Todas' || (order.prioridad || 'Normal') === priorityFilter;
    return matchesQuery && matchesRange && matchesStatus && matchesTechnician && matchesZone && matchesPriority;
  }).sort((a, b) => `${a.fecha} ${a.hora_inicio || ''}`.localeCompare(`${b.fecha} ${b.hora_inicio || ''}`)), [
    data.ordenes, data.clientes, data.vehiculos, query, dateRange, statusFilter, technicianFilter, zoneFilter, priorityFilter,
  ]);

  const openNewOrder = () => {
    setEditingOrder(null);
    setForm({
      vehiculoId: '', servicio: '', fecha: currentDate(), hora_inicio: '', tecnico_id: '',
      prioridad: 'Normal', estado: 'Pendiente', zona: '', direccion: '', duracion_estimada: '60', descripcion: '', observaciones: '',
    });
    setError('');
    setShowModal(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder(order);
    setForm({
      vehiculoId: String(order.vehiculoId || ''),
      servicio: order.servicio || '',
      fecha: order.fecha || currentDate(),
      hora_inicio: String(order.hora_inicio || '').slice(0, 5),
      tecnico_id: String(order.tecnico_id || ''),
      prioridad: order.prioridad || 'Normal',
      estado: order.estado || 'Pendiente',
      zona: order.zona || '',
      direccion: order.direccion || '',
      duracion_estimada: String(order.duracion_estimada || 60),
      descripcion: order.descripcion || '',
      observaciones: order.observaciones || '',
    });
    setError('');
    setShowModal(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const vehicle = data.vehiculos.find((item) => item.id === Number(form.vehiculoId));
    const technician = data.tecnicos.find((item) => item.id === Number(form.tecnico_id));
    if (!vehicle && (!editingOrder || form.vehiculoId)) {
      setError('Selecciona un vehículo válido.');
      setSaving(false);
      return;
    }
    const startMinutes = (value) => {
      const [hours, minutes] = String(value || '').split(':').map(Number);
      return hours * 60 + minutes;
    };
    const proposedStart = startMinutes(form.hora_inicio);
    const proposedEnd = proposedStart + (Number(form.duracion_estimada) || 60);
    const conflict = Boolean(technician && form.hora_inicio && data.ordenes.some((order) => {
      if (order.id === editingOrder?.id || Number(order.tecnico_id) !== technician.id ||
        order.fecha !== form.fecha || !order.hora_inicio ||
        ['Completado', 'Cancelado'].includes(order.estado)) return false;
      const existingStart = startMinutes(order.hora_inicio);
      const existingEnd = existingStart + (Number(order.duracion_estimada) || 60);
      return proposedStart < existingEnd && existingStart < proposedEnd;
    }));
    if (conflict && !window.confirm('El técnico ya tiene una orden a esa hora. ¿Deseas guardar de todas formas?')) {
      setSaving(false);
      return;
    }
    try {
      const orderData = {
        ...form,
        estado: editingOrder ? form.estado : (technician ? 'Asignado' : 'Pendiente'),
        vehiculoId: vehicle?.id || null,
        clienteId: vehicle?.clienteId || null,
        tecnico_id: technician?.id || null,
        tecnico: technician?.nombre || null,
        hora_inicio: form.hora_inicio || null,
        duracion_estimada: Number(form.duracion_estimada) || 60,
      };
      if (editingOrder) await updateOrden(editingOrder.id, orderData);
      else await addOrden(orderData);
      setShowModal(false);
      setNotice(editingOrder ? 'La orden se actualizó correctamente.' : 'La orden de trabajo se creó correctamente.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (order, estado) => {
    if (estado === 'Cancelado' && !window.confirm(`¿Confirmas cancelar la orden ${order.id}?`)) return;
    setError('');
    try {
      await updateOrdenEstado(order.id, estado);
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando agenda...</p>;

  return (
    <div className="space-y-6">
      <PageTitle title="Agenda y órdenes de trabajo" description="Programa visitas, asigna técnicos y actualiza el estado de cada servicio."
        actions={<><ExportActions title="Agenda y órdenes" rows={orders.map((order) => ({
          Orden: order.id, Fecha: order.fecha, Hora: order.hora_inicio, Servicio: order.servicio,
          Cliente: data.clientes.find((item) => item.id === order.clienteId)?.nombre || '',
          Patente: data.vehiculos.find((item) => item.id === order.vehiculoId)?.patente || '',
          Técnico: order.tecnico, Prioridad: order.prioridad, Estado: order.estado,
          Zona: order.zona, Dirección: order.direccion, 'Duración estimada (min)': order.duracion_estimada,
          Descripción: order.descripcion, Observaciones: order.observaciones,
        }))} />{!isTechnician && <button onClick={openNewOrder} disabled={!data.vehiculos.some((vehicle) => !vehicle.archived_at && vehicle.estado === 'Activo')} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nueva orden</button>}</>} />
      <InlineMessage tone="success">{notice}</InlineMessage>
      <InlineMessage>{actionError}</InlineMessage>
      <InlineMessage>{error || dataError}</InlineMessage>
      {!isTechnician && !data.vehiculos.some((vehicle) => !vehicle.archived_at && vehicle.estado === 'Activo') && <InlineMessage tone="info">Registra primero un cliente y un vehículo activo para crear órdenes de trabajo.</InlineMessage>}

      <section className="card grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative md:col-span-2 xl:col-span-2">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-10`} placeholder="Buscar orden, patente, cliente o técnico" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Vista de agenda">
          <option value="dia">Día</option><option value="semana">Semana</option><option value="mes">Mes</option>
        </select>
        <input className={inputClass} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Fecha de agenda" />
        <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar estado">
          <option>Todos</option>{statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className={inputClass} value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)} aria-label="Filtrar técnico">
          <option>Todos</option>{data.tecnicos.filter((technician) => !technician.archived_at).map((technician) => <option key={technician.id} value={technician.id}>{technician.nombre}</option>)}
        </select>
        <select className={inputClass} value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} aria-label="Filtrar zona">
          <option>Todas</option>{[...new Set(data.ordenes.filter((order) => !order.archived_at).map((order) => order.zona || 'Sin zona'))].map((zone) => <option key={zone}>{zone}</option>)}
        </select>
        <select className={inputClass} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filtrar prioridad">
          <option>Todas</option>{['Baja', 'Normal', 'Alta', 'Urgente'].map((priority) => <option key={priority}>{priority}</option>)}
        </select>
      </section>

      <section className="space-y-3">
        {orders.length ? orders.map((order) => {
          const client = data.clientes.find((item) => item.id === order.clienteId);
          const vehicle = data.vehiculos.find((item) => item.id === order.vehiculoId);
          return <article key={order.id} className="card grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-brand-blue">{order.id}</span><StatusBadge value={order.estado} /><StatusBadge value={order.prioridad || 'Normal'} /></div>
              <div><h3 className="text-lg font-bold text-brand-dark">{order.servicio}</h3><p className="text-sm text-slate-600">{client?.nombre || 'Cliente no disponible'} · {vehicle?.patente || 'Sin vehículo'}</p></div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />{formatDate(order.fecha)} {order.hora_inicio || ''}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 size={15} />{order.duracion_estimada || 60} min</span>
                {order.direccion && <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{order.direccion}</span>}
              </div>
              <p className="text-sm text-slate-600">Técnico: <span className="font-medium">{order.tecnico || 'Sin asignar'}</span>{order.descripcion ? ` · ${order.descripcion}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 lg:flex-col lg:items-end lg:justify-between">
              <label className="sr-only" htmlFor={`status-${order.id}`}>Estado de {order.id}</label>
              <select id={`status-${order.id}`} className={`${inputClass} w-auto min-w-44`} value={order.estado} onChange={(event) => changeStatus(order, event.target.value)}>
                {(isTechnician ? ['Asignado', 'Confirmado', 'En proceso', 'Esperando repuestos', 'Completado'] : statuses).map((status) => <option key={status}>{status}</option>)}
              </select>
              <div className="flex items-center gap-3">
                {!isTechnician && <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue" onClick={() => openEditOrder(order)}><Pencil size={15} /> Editar</button>}
                {isAdmin && <ArchiveButton label={`la orden ${order.id}`}
                  onArchive={async () => { await archiveRecord('ordenes', order.id); setNotice(`La orden ${order.id} se archivó. Puedes restaurarla desde Papelera.`); }}
                  onError={setActionError} />}
                <Link className="text-sm font-semibold text-brand-blue" to={`/informes?orden=${encodeURIComponent(order.id)}`}>Abrir informe técnico</Link>
              </div>
            </div>
          </article>;
        }) : <EmptyState title="No hay órdenes en este período" detail="Prueba con otro rango de fechas o crea una nueva orden." />}
      </section>

      {showModal && <Modal title={editingOrder ? `Editar orden ${editingOrder.id}` : 'Crear orden de trabajo'} onClose={() => setShowModal(false)} size="max-w-3xl">
        <form onSubmit={submit} className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          <InlineMessage>{error}</InlineMessage>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehículo"><select className={inputClass} required={!editingOrder} value={form.vehiculoId} onChange={(event) => setForm({ ...form, vehiculoId: event.target.value })}>
              <option value="">{editingOrder ? 'Sin asignar' : 'Selecciona vehículo'}</option>
              {data.vehiculos.filter((vehicle) => (!vehicle.archived_at && vehicle.estado === 'Activo') || Number(form.vehiculoId) === vehicle.id).map((vehicle) => {
                const client = data.clientes.find((item) => item.id === vehicle.clienteId);
                return <option key={vehicle.id} value={vehicle.id}>{vehicle.patente} · {client?.nombre || 'Cliente'}{vehicle.archived_at ? ' (Archivado)' : ''}</option>;
              })}
            </select></Field>
            <Field label="Tipo de servicio"><select className={inputClass} required value={form.servicio} onChange={(event) => setForm({ ...form, servicio: event.target.value })}>
              <option value="">Selecciona servicio</option>{serviceTypes.map((service) => <option key={service}>{service}</option>)}
            </select></Field>
            <Field label="Fecha"><input className={inputClass} required type="date" min={currentDate()} value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /></Field>
            <Field label="Hora"><input className={inputClass} type="time" value={form.hora_inicio} onChange={(event) => setForm({ ...form, hora_inicio: event.target.value })} /></Field>
            <Field label="Duración estimada (minutos)"><input className={inputClass} type="number" min="15" step="15" value={form.duracion_estimada} onChange={(event) => setForm({ ...form, duracion_estimada: event.target.value })} /></Field>
            <Field label="Prioridad"><select className={inputClass} value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value })}><option>Baja</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></Field>
            {editingOrder && <Field label="Estado"><select className={inputClass} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>}
            <Field label="Técnico asignado"><select className={inputClass} value={form.tecnico_id} onChange={(event) => setForm({ ...form, tecnico_id: event.target.value })}>
              <option value="">Sin asignar</option>{data.tecnicos.filter((technician) => (!technician.archived_at && technician.estado === 'Activo') || Number(form.tecnico_id) === technician.id).map((technician) => <option key={technician.id} value={technician.id}>{technician.nombre}{technician.archived_at ? ' (Archivado)' : ''}</option>)}
            </select></Field>
            <Field label="Zona"><input className={inputClass} value={form.zona} onChange={(event) => setForm({ ...form, zona: event.target.value })} /></Field>
            <Field label="Dirección de servicio" className="sm:col-span-2"><input className={inputClass} value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></Field>
            <Field label="Descripción del problema" className="sm:col-span-2"><textarea className={inputClass} required rows={3} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
            <Field label="Observaciones" className="sm:col-span-2"><textarea className={inputClass} rows={2} value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></Field>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving || (!editingOrder && !data.vehiculos.some((vehicle) => !vehicle.archived_at && vehicle.estado === 'Activo'))} className="btn-primary">{saving ? 'Guardando...' : editingOrder ? 'Guardar cambios' : 'Crear orden'}</button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
