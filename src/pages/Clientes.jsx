import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { DeleteButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const blankClient = {
  tipo: 'Empresa', nombre: '', rut: '', contacto: '', telefono: '', email: '',
  direccion: '', comuna: '', ciudad: '', condiciones_pago: '', notas: '', estado: 'Activo',
};

export default function Clientes() {
  const { user } = useAuth();
  const { data, saveCliente, deleteRecord, isLoaded, dataError } = useData();
  const isAdmin = user?.role === 'Administrador';
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(blankClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const filtered = useMemo(() => data.clientes.filter((client) => {
    const query = search.trim().toLowerCase();
    return !query || [client.nombre, client.rut, client.contacto, client.telefono, client.email]
      .some((value) => value?.toLowerCase().includes(query));
  }), [data.clientes, search]);

  const openCreate = () => {
    setForm(blankClient);
    setError('');
    setShowModal(true);
  };

  const openEdit = (client) => {
    setForm({ ...blankClient, ...client });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveCliente({
        ...form,
        nombre: form.nombre.trim(),
        rut: form.rut.trim(),
        contacto: form.contacto.trim(),
        email: form.email.trim() || null,
        updated_at: new Date().toISOString(),
      });
      setShowModal(false);
      setNotice('El cliente se guardó correctamente.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando clientes...</p>;

  return (
    <div className="space-y-6">
      <PageTitle title="Clientes" description="Administra datos de contacto y condiciones comerciales."
      actions={<><ExportActions title="Clientes" rows={filtered.map((client) => ({
        Cliente: client.nombre, Tipo: client.tipo, RUT: client.rut, Contacto: client.contacto,
        Teléfono: client.telefono, Correo: client.email, Dirección: client.direccion,
        Comuna: client.comuna, Ciudad: client.ciudad,
        Vehículos: data.vehiculos.filter((vehicle) => vehicle.clienteId === client.id).length,
        Estado: client.estado,
      }))} /><button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo cliente</button></>} />
      <InlineMessage tone="success">{notice}</InlineMessage>
      <InlineMessage>{actionError}</InlineMessage>
      {dataError && <InlineMessage>{dataError}</InlineMessage>}

      <section className="card space-y-4">
        <div className="relative max-w-xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, RUT, teléfono o correo" aria-label="Buscar clientes" />
        </div>

        {filtered.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-3 pr-4">Cliente</th><th className="pb-3 pr-4">RUT</th><th className="pb-3 pr-4">Contacto</th><th className="pb-3 pr-4">Teléfono / correo</th><th className="pb-3 pr-4">Vehículos</th><th className="pb-3 pr-4">Estado</th><th className="pb-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y">
              {filtered.map((client) => <tr key={client.id} className="hover:bg-slate-50">
                <td className="py-4 pr-4"><p className="font-semibold text-brand-dark">{client.nombre}</p><p className="text-xs text-slate-500">{client.tipo || 'Empresa'}</p></td>
                <td className="py-4 pr-4 text-slate-600">{client.rut}</td>
                <td className="py-4 pr-4 text-slate-600">{client.contacto || '—'}</td>
                <td className="py-4 pr-4 text-slate-600">{client.telefono || '—'}<br /><span className="text-xs">{client.email || ''}</span></td>
                <td className="py-4 pr-4">{data.vehiculos.filter((vehicle) => vehicle.clienteId === client.id).length}</td>
                <td className="py-4 pr-4"><StatusBadge value={client.estado} /></td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(client)} className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"><Pencil size={14} /> Editar</button>
                    {isAdmin && <DeleteButton label={`al cliente ${client.nombre}`}
                      onDelete={async () => { await deleteRecord('clientes', client.id); setNotice('El cliente se eliminó correctamente.'); }}
                      onError={setActionError} />}
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div> : <EmptyState title={search ? 'No hay resultados para esa búsqueda' : 'Aún no hay clientes registrados'} detail={search ? 'Prueba con otro nombre, RUT o dato de contacto.' : 'Registra un cliente para asociar vehículos y órdenes.'} />}
      </section>

      {showModal && <Modal title={form.id ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          <InlineMessage>{error}</InlineMessage>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de cliente">
              <select className={inputClass} value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}>
                <option>Empresa</option><option>Persona natural</option>
              </select>
            </Field>
            <Field label={form.tipo === 'Empresa' ? 'Razón social' : 'Nombre completo'}>
              <input className={inputClass} required maxLength={160} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
            </Field>
            <Field label="RUT / Identificador fiscal">
              <input className={inputClass} required maxLength={30} value={form.rut} onChange={(event) => setForm({ ...form, rut: event.target.value })} />
            </Field>
            <Field label="Contacto principal">
              <input className={inputClass} required maxLength={120} value={form.contacto} onChange={(event) => setForm({ ...form, contacto: event.target.value })} />
            </Field>
            <Field label="Teléfono">
              <input className={inputClass} type="tel" maxLength={40} value={form.telefono || ''} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
            </Field>
            <Field label="Correo electrónico">
              <input className={inputClass} type="email" maxLength={160} value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Dirección"><input className={inputClass} maxLength={200} value={form.direccion || ''} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></Field>
            <Field label="Comuna"><input className={inputClass} maxLength={100} value={form.comuna || ''} onChange={(event) => setForm({ ...form, comuna: event.target.value })} /></Field>
            <Field label="Ciudad"><input className={inputClass} maxLength={100} value={form.ciudad || ''} onChange={(event) => setForm({ ...form, ciudad: event.target.value })} /></Field>
            <Field label="Condiciones de pago"><input className={inputClass} maxLength={200} value={form.condiciones_pago || ''} onChange={(event) => setForm({ ...form, condiciones_pago: event.target.value })} /></Field>
            <Field label="Estado">
              <select className={inputClass} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option>Activo</option><option>Inactivo</option>
              </select>
            </Field>
            <Field label="Notas comerciales" className="sm:col-span-2">
              <textarea className={inputClass} rows={3} maxLength={2000} value={form.notas || ''} onChange={(event) => setForm({ ...form, notas: event.target.value })} />
            </Field>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar cliente'}</button>
          </div>
        </form>
      </Modal>}

      {!data.clientes.length && !dataError && <p className="flex items-center gap-2 text-xs text-slate-400"><Users size={14} /> Los datos ingresados se guardan en tu proyecto Supabase.</p>}
    </div>
  );
}
