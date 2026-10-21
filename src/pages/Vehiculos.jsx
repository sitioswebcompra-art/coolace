import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { DeleteButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, formatDate, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const blankVehicle = {
  patente: '', marca: '', modelo: '', clienteId: '', estado: 'Activo', anio: '',
  vin: '', tipo_vehiculo: '', kilometraje: '', equipo_marca: '', equipo_modelo: '',
  refrigerante: '', capacidad_enfriamiento: '', horas_uso: '', tipo_sistema: '',
  numero_serie_equipo: '', fecha_instalacion: '', ultimo_mantenimiento: '',
  proximo_mantenimiento: '', observaciones: '',
};

export default function Vehiculos() {
  const { user } = useAuth();
  const { data, saveVehiculo, deleteRecord, isLoaded, dataError } = useData();
  const readOnly = user?.role === 'Cliente';
  const isAdmin = user?.role === 'Administrador';
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(blankVehicle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const filtered = useMemo(() => data.vehiculos.filter((vehicle) => {
    const client = data.clientes.find((item) => item.id === vehicle.clienteId);
    const query = search.trim().toLowerCase();
    return !query || [vehicle.patente, vehicle.marca, vehicle.modelo, vehicle.vin, client?.nombre]
      .some((value) => value?.toLowerCase().includes(query));
  }), [data.vehiculos, data.clientes, search]);

  const openCreate = () => {
    setForm(blankVehicle);
    setError('');
    setShowModal(true);
  };

  const openEdit = (vehicle) => {
    setForm({ ...blankVehicle, ...vehicle, clienteId: String(vehicle.clienteId || '') });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const numberOrNull = (value) => value === '' || value == null ? null : Number(value);
    try {
      await saveVehiculo({
        ...form,
        patente: form.patente.trim().toUpperCase(),
        clienteId: Number(form.clienteId),
        anio: numberOrNull(form.anio),
        kilometraje: numberOrNull(form.kilometraje),
        horas_uso: numberOrNull(form.horas_uso),
        fecha_instalacion: form.fecha_instalacion || null,
        ultimo_mantenimiento: form.ultimo_mantenimiento || null,
        proximo_mantenimiento: form.proximo_mantenimiento || null,
        updated_at: new Date().toISOString(),
      });
      setShowModal(false);
      setNotice('El vehículo se guardó correctamente.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando vehículos...</p>;

  return (
    <div className="space-y-6">
      <PageTitle title="Vehículos" description="Administra los vehículos y sus equipos de refrigeración."
      actions={<><ExportActions title="Vehículos" rows={filtered.map((vehicle) => ({
        Cliente: data.clientes.find((item) => item.id === vehicle.clienteId)?.nombre || '',
        Patente: vehicle.patente, Marca: vehicle.marca, Modelo: vehicle.modelo,
        Año: vehicle.anio, VIN: vehicle.vin, Tipo: vehicle.tipo_vehiculo,
        Kilometraje: vehicle.kilometraje, Equipo: [vehicle.equipo_marca, vehicle.equipo_modelo].filter(Boolean).join(' '),
        Refrigerante: vehicle.refrigerante, 'Último mantenimiento': vehicle.ultimo_mantenimiento,
        'Próximo mantenimiento': vehicle.proximo_mantenimiento, Estado: vehicle.estado,
      }))} />{!readOnly && <button onClick={openCreate} disabled={!data.clientes.length} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo vehículo</button>}</>} />
      <InlineMessage tone="success">{notice}</InlineMessage>
      <InlineMessage>{actionError}</InlineMessage>
      {dataError && <InlineMessage>{dataError}</InlineMessage>}
      {!readOnly && !data.clientes.length && <InlineMessage tone="info">Para registrar un vehículo, primero crea un cliente.</InlineMessage>}

      <section className="card space-y-4">
        <div className="relative max-w-xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar patente, marca, VIN o cliente" aria-label="Buscar vehículos" />
        </div>
        {filtered.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-3 pr-4">Vehículo</th><th className="pb-3 pr-4">Patente / año</th><th className="pb-3 pr-4">Cliente</th><th className="pb-3 pr-4">Equipo refrigerante</th><th className="pb-3 pr-4">Próximo mantenimiento</th><th className="pb-3 pr-4">Estado</th><th className="pb-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y">
              {filtered.map((vehicle) => {
                const client = data.clientes.find((item) => item.id === vehicle.clienteId);
                return <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="py-4 pr-4"><p className="font-semibold text-brand-dark">{vehicle.marca} {vehicle.modelo}</p><p className="text-xs text-slate-500">{vehicle.tipo_vehiculo || 'Vehículo'}</p></td>
                  <td className="py-4 pr-4"><p className="font-bold text-brand-blue">{vehicle.patente}</p><p className="text-xs text-slate-500">{vehicle.anio || 'Año no indicado'}</p></td>
                  <td className="py-4 pr-4">{client?.nombre || 'Cliente no disponible'}</td>
                  <td className="py-4 pr-4">{vehicle.equipo_marca ? `${vehicle.equipo_marca} ${vehicle.equipo_modelo || ''}` : 'No especificado'}</td>
                  <td className="py-4 pr-4">{formatDate(vehicle.proximo_mantenimiento)}</td>
                  <td className="py-4 pr-4"><StatusBadge value={vehicle.estado} /></td>
                  <td className="py-4 text-right"><div className="flex justify-end gap-2">
                    {!readOnly && <button onClick={() => openEdit(vehicle)} className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"><Pencil size={14} /> Editar</button>}
                    {isAdmin && <DeleteButton label={`el vehículo ${vehicle.patente}`}
                      onDelete={async () => { await deleteRecord('vehiculos', vehicle.id); setNotice('El vehículo se eliminó correctamente.'); }}
                      onError={setActionError} />}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <EmptyState title={search ? 'No hay resultados para esa búsqueda' : 'Aún no hay vehículos registrados'} detail={search ? 'Prueba con otra patente, marca o nombre de cliente.' : 'Registra un vehículo para programar un servicio.'} />}
      </section>

      {showModal && <Modal title={form.id ? 'Editar vehículo' : 'Nuevo vehículo'} onClose={() => setShowModal(false)} size="max-w-4xl">
        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          <InlineMessage>{error}</InlineMessage>
          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-3 text-sm font-bold text-brand-blue">Datos del vehículo</legend>
            <Field label="Cliente asociado">
              <select className={inputClass} required value={form.clienteId} onChange={(event) => setForm({ ...form, clienteId: event.target.value })}>
                <option value="">Selecciona un cliente</option>
                {data.clientes.filter((client) => client.estado === 'Activo' || client.id === Number(form.clienteId)).map((client) => <option key={client.id} value={client.id}>{client.nombre} · {client.rut}</option>)}
              </select>
            </Field>
            <Field label="Patente / placa"><input className={inputClass} required maxLength={20} value={form.patente} onChange={(event) => setForm({ ...form, patente: event.target.value.toUpperCase() })} /></Field>
            <Field label="Marca"><input className={inputClass} required maxLength={80} value={form.marca} onChange={(event) => setForm({ ...form, marca: event.target.value })} /></Field>
            <Field label="Modelo"><input className={inputClass} required maxLength={100} value={form.modelo} onChange={(event) => setForm({ ...form, modelo: event.target.value })} /></Field>
            <Field label="Año"><input className={inputClass} type="number" min="1900" max="2100" value={form.anio || ''} onChange={(event) => setForm({ ...form, anio: event.target.value })} /></Field>
            <Field label="VIN / número de chasis"><input className={inputClass} maxLength={80} value={form.vin || ''} onChange={(event) => setForm({ ...form, vin: event.target.value })} /></Field>
            <Field label="Tipo de vehículo"><input className={inputClass} placeholder="Camión, furgón, bus..." value={form.tipo_vehiculo || ''} onChange={(event) => setForm({ ...form, tipo_vehiculo: event.target.value })} /></Field>
            <Field label="Kilometraje"><input className={inputClass} type="number" min="0" value={form.kilometraje ?? ''} onChange={(event) => setForm({ ...form, kilometraje: event.target.value })} /></Field>
            <Field label="Estado"><select className={inputClass} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}><option>Activo</option><option>En mantenimiento</option><option>Inactivo</option></select></Field>
          </fieldset>

          <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-3 text-sm font-bold text-brand-blue">Equipo de refrigeración</legend>
            <Field label="Marca del equipo"><input className={inputClass} value={form.equipo_marca || ''} onChange={(event) => setForm({ ...form, equipo_marca: event.target.value })} /></Field>
            <Field label="Modelo del equipo"><input className={inputClass} value={form.equipo_modelo || ''} onChange={(event) => setForm({ ...form, equipo_modelo: event.target.value })} /></Field>
            <Field label="Número de serie"><input className={inputClass} value={form.numero_serie_equipo || ''} onChange={(event) => setForm({ ...form, numero_serie_equipo: event.target.value })} /></Field>
            <Field label="Tipo de refrigerante"><input className={inputClass} placeholder="R-134a..." value={form.refrigerante || ''} onChange={(event) => setForm({ ...form, refrigerante: event.target.value })} /></Field>
            <Field label="Capacidad de enfriamiento"><input className={inputClass} value={form.capacidad_enfriamiento || ''} onChange={(event) => setForm({ ...form, capacidad_enfriamiento: event.target.value })} /></Field>
            <Field label="Tipo de sistema"><input className={inputClass} value={form.tipo_sistema || ''} onChange={(event) => setForm({ ...form, tipo_sistema: event.target.value })} /></Field>
            <Field label="Horas de uso"><input className={inputClass} type="number" min="0" step="0.1" value={form.horas_uso ?? ''} onChange={(event) => setForm({ ...form, horas_uso: event.target.value })} /></Field>
            <Field label="Fecha de instalación"><input className={inputClass} type="date" value={form.fecha_instalacion || ''} onChange={(event) => setForm({ ...form, fecha_instalacion: event.target.value || null })} /></Field>
            <Field label="Último mantenimiento"><input className={inputClass} type="date" value={form.ultimo_mantenimiento || ''} onChange={(event) => setForm({ ...form, ultimo_mantenimiento: event.target.value || null })} /></Field>
            <Field label="Próximo mantenimiento"><input className={inputClass} type="date" value={form.proximo_mantenimiento || ''} onChange={(event) => setForm({ ...form, proximo_mantenimiento: event.target.value || null })} /></Field>
            <Field label="Observaciones" className="sm:col-span-2 lg:col-span-3"><textarea className={inputClass} rows={3} value={form.observaciones || ''} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></Field>
          </fieldset>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving || !data.clientes.length} className="btn-primary">{saving ? 'Guardando...' : 'Guardar vehículo'}</button>
          </div>
        </form>
      </Modal>}
      {!data.vehiculos.length && !dataError && <p className="flex items-center gap-2 text-xs text-slate-400"><Truck size={14} /> Los vehículos están relacionados con su cliente y disponibles para crear órdenes.</p>}
    </div>
  );
}
