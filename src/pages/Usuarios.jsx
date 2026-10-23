import { useEffect, useMemo, useState } from 'react';
import { Save, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { EmptyState, Field, InlineMessage, PageTitle, StatusBadge, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const roles = ['Administrador', 'Supervisor', 'Técnico', 'Área administrativa', 'Cliente'];

function profileDraft(profile, technicians) {
  return {
    role: profile.role,
    active: profile.activo,
    clienteId: profile.cliente_id ? String(profile.cliente_id) : '',
    tecnicoId: String(technicians.find((technician) => technician.user_id === profile.id)?.id || ''),
  };
}

export default function Usuarios() {
  const { user } = useAuth();
  const { data, isLoaded, dataError, saveUserAccess } = useData();
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDrafts(Object.fromEntries(data.profiles.map((profile) => [
      profile.id,
      profileDraft(profile, data.tecnicos),
    ])));
  }, [data.profiles, data.tecnicos]);

  const activeAdmins = useMemo(
    () => data.profiles.filter((profile) => profile.role === 'Administrador' && profile.activo).length,
    [data.profiles],
  );

  const updateDraft = (profileId, patch) => {
    setDrafts((current) => ({ ...current, [profileId]: { ...current[profileId], ...patch } }));
  };

  const save = async (profile) => {
    const draft = drafts[profile.id];
    if (!draft) return;
    setSavingId(profile.id);
    setError('');
    setNotice('');
    try {
      await saveUserAccess({
        userId: profile.id,
        role: draft.role,
        active: draft.active,
        clienteId: draft.role === 'Cliente' ? draft.clienteId : null,
        tecnicoId: draft.role === 'Técnico' ? draft.tecnicoId : null,
      });
      setNotice(`Permisos actualizados para ${profile.name}.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingId('');
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando usuarios...</p>;

  return <div className="space-y-6">
    <PageTitle title="Usuarios y roles"
      description="Asigna permisos y vincula cada cuenta con su registro de cliente o técnico."
      actions={<ExportActions title="Usuarios y roles" rows={data.profiles.map((profile) => ({
        Nombre: profile.name, Correo: profile.email, Rol: profile.role,
        Cliente: data.clientes.find((client) => client.id === profile.cliente_id)?.nombre || '',
        Técnico: data.tecnicos.find((technician) => technician.user_id === profile.id)?.nombre || '',
        Estado: profile.activo ? 'Activo' : 'Inactivo', 'Fecha de creación': profile.created_at,
      }))} />} />
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    {error && <InlineMessage>{error}</InlineMessage>}
    {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
    <InlineMessage tone="info">
      Aquí aparecen las cuentas existentes de Supabase Authentication. Para agregar una cuenta, créala en Authentication &gt; Users; después podrás asignarle su rol en esta pantalla.
    </InlineMessage>

    {data.profiles.length ? <section className="space-y-4">
      {data.profiles.map((profile) => {
        const draft = drafts[profile.id] || profileDraft(profile, data.tecnicos);
        const isSelf = profile.id === user?.id;
        const availableTechnicians = data.tecnicos.filter((technician) =>
          (technician.archived_at && technician.id === Number(draft.tecnicoId)) ||
          (!technician.archived_at && technician.estado === 'Activo' &&
            (!technician.user_id || technician.user_id === profile.id || technician.id === Number(draft.tecnicoId)))
        );

        return <article key={profile.id} className="card space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-xl bg-blue-50 p-3 text-brand-blue"><UserCog size={22} /></span>
              <div className="min-w-0">
                <h3 className="truncate font-bold text-brand-dark">{profile.name}</h3>
                <p className="truncate text-sm text-slate-500">{profile.email || 'Correo no disponible'}</p>
              </div>
            </div>
            <StatusBadge value={draft.active ? 'Activo' : 'Inactivo'} />
          </div>

          {isSelf && <InlineMessage tone="info">Para proteger el acceso administrativo, cambia tu propio rol o estado desde otra cuenta administradora.</InlineMessage>}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Rol de usuario">
              <select
                className={inputClass}
                value={draft.role}
                disabled={isSelf}
                onChange={(event) => {
                  const role = event.target.value;
                  updateDraft(profile.id, {
                    role,
                    clienteId: role === 'Cliente' ? draft.clienteId : '',
                    tecnicoId: role === 'Técnico' ? draft.tecnicoId : '',
                  });
                }}
              >
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </Field>

            {draft.role === 'Cliente' && <Field label="Cliente asociado">
              <select
                required
                className={inputClass}
                value={draft.clienteId}
                onChange={(event) => updateDraft(profile.id, { clienteId: event.target.value })}
              >
                <option value="">Selecciona un cliente</option>
                {data.clientes.filter((client) => !client.archived_at || client.id === Number(draft.clienteId)).map((client) => <option key={client.id} value={client.id}>{client.nombre} · {client.rut}{client.archived_at ? ' (Archivado)' : ''}</option>)}
              </select>
            </Field>}

            {draft.role === 'Técnico' && <Field label="Técnico asociado">
              <select
                required
                className={inputClass}
                value={draft.tecnicoId}
                onChange={(event) => updateDraft(profile.id, { tecnicoId: event.target.value })}
              >
                <option value="">Selecciona un técnico</option>
                {availableTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.nombre} · {technician.zona || 'Sin zona'}{technician.archived_at ? ' (Archivado)' : ''}</option>)}
              </select>
              {!availableTechnicians.length && <span className="text-xs text-amber-700">Crea primero el registro del técnico en el módulo Técnicos.</span>}
            </Field>}

            <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${isSelf ? 'bg-slate-50 opacity-70' : ''}`}>
              <input
                type="checkbox"
                checked={draft.active}
                disabled={isSelf}
                onChange={(event) => updateDraft(profile.id, { active: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-electric"
              />
              <span className="text-sm font-medium text-slate-700">Cuenta habilitada</span>
            </label>
          </div>

          <div className="flex justify-end border-t pt-4">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              disabled={isSelf || savingId === profile.id || (draft.active && draft.role === 'Cliente' && !draft.clienteId) || (draft.role === 'Técnico' && !draft.tecnicoId)}
              onClick={() => save(profile)}
            >
              {savingId === profile.id ? <ShieldCheck size={16} /> : <Save size={16} />}
              {savingId === profile.id ? 'Guardando...' : 'Guardar permisos'}
            </button>
          </div>
        </article>;
      })}
    </section> : <EmptyState
      title="No hay perfiles de usuario"
      detail="Crea cuentas en Supabase Authentication y aplica la migración de database.sql para administrarlas aquí."
    />}

    {activeAdmins <= 1 && <p className="text-xs text-slate-500">El último administrador activo no puede desactivarse ni perder su rol.</p>}
  </div>;
}
