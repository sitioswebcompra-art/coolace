import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, UserRound, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { DeleteButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const blank = { nombre: '', telefono: '', email: '', especialidad: '', zona: '', estado: 'Activo' };

export default function Tecnicos() {
  const { user } = useAuth();
  const { data, saveTecnico, deleteRecord, isLoaded, dataError } = useData();
  const isAdmin = user?.role === 'Administrador';
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => data.tecnicos.filter((person) =>
    [person.nombre, person.telefono, person.email, person.especialidad, person.zona]
      .some((value) => value?.toLowerCase().includes(query.trim().toLowerCase()))
  ), [data.tecnicos, query]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveTecnico({ ...form, nombre: form.nombre.trim(), updated_at: new Date().toISOString() });
      setOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando técnicos...</p>;
  return <div className="space-y-6">
    <PageTitle title="Técnicos y cuadrillas" description="Administra el personal de terreno, especialidades y zonas de servicio."
      actions={<><ExportActions title="Técnicos y cuadrillas" rows={filtered.map((technician) => ({
        Técnico: technician.nombre, Teléfono: technician.telefono, Correo: technician.email,
        Especialidad: technician.especialidad, Zona: technician.zona, Estado: technician.estado,
        'Trabajos activos': data.ordenes.filter((order) => Number(order.tecnico_id) === technician.id &&
          !['Completado', 'Cancelado'].includes(order.estado)).length,
      }))} /><button onClick={() => { setForm(blank); setError(''); setOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo técnico</button></>} />
    <InlineMessage>{actionError}</InlineMessage>
    <InlineMessage tone="success">{notice}</InlineMessage>
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <div className="relative max-w-xl">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className={`${inputClass} pl-10`} placeholder="Buscar técnico, especialidad o zona" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    {filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((technician) => {
        const assigned = data.ordenes.filter((order) => Number(order.tecnico_id) === technician.id && !['Completado', 'Cancelado'].includes(order.estado)).length;
        return <article key={technician.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><span className="rounded-full bg-blue-50 p-3 text-brand-blue"><UserRound size={22} /></span>
              <div><h3 className="font-bold text-brand-dark">{technician.nombre}</h3><p className="text-sm text-slate-500">{technician.especialidad || 'Técnico de servicio'}</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button title="Editar técnico" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setForm({ ...blank, ...technician }); setError(''); setOpen(true); }}><Pencil size={17} /></button>
              {isAdmin && <DeleteButton label={`al técnico ${technician.nombre}`}
                onDelete={async () => { await deleteRecord('tecnicos', technician.id); setNotice('El técnico se eliminó correctamente.'); }}
                onError={setActionError} />}
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>{technician.telefono || 'Teléfono no registrado'}</p><p>{technician.email || 'Correo no registrado'}</p>
            <p>Zona: {technician.zona || 'Sin zona asignada'}</p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4"><StatusBadge value={technician.estado} /><span className="inline-flex items-center gap-1.5 text-sm text-slate-500"><Wrench size={15} />{assigned} trabajo(s) activo(s)</span></div>
        </article>;
      })}
    </div> : <EmptyState title={query ? 'No se encontraron técnicos' : 'Aún no hay técnicos registrados'} detail={query ? 'Prueba con otro nombre, especialidad o zona.' : 'Agrega personal para poder asignarlo a las órdenes.'} />}
    {open && <Modal title={form.id ? 'Editar técnico' : 'Nuevo técnico'} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <InlineMessage>{error}</InlineMessage>
        <Field label="Nombre completo"><input required maxLength={160} className={inputClass} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono"><input type="tel" className={inputClass} value={form.telefono || ''} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></Field>
          <Field label="Correo"><input type="email" className={inputClass} value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Especialidad"><input className={inputClass} value={form.especialidad || ''} onChange={(event) => setForm({ ...form, especialidad: event.target.value })} /></Field>
          <Field label="Zona"><input className={inputClass} value={form.zona || ''} onChange={(event) => setForm({ ...form, zona: event.target.value })} /></Field>
          <Field label="Estado"><select className={inputClass} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}><option>Activo</option><option>Inactivo</option></select></Field>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar técnico'}</button>
        </div>
      </form>
    </Modal>}
  </div>;
}
