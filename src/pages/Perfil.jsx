import { useState } from 'react';
import { KeyRound, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field, InlineMessage, PageTitle, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

export default function Perfil() {
  const { user, updatePassword, passwordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    if (result.success) {
      setNotice('La contraseña se actualizó correctamente.');
      setPassword('');
      setConfirmation('');
    } else setError(result.message);
    setBusy(false);
  };

  return <div className="space-y-6">
    <PageTitle title="Mi perfil" description="Datos de tu cuenta y opciones de seguridad."
      actions={<ExportActions title="Mi perfil" rows={[{
        Nombre: user?.name, Correo: user?.email, Rol: user?.role,
      }]} />} />
    {error && <InlineMessage>{error}</InlineMessage>}
    {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
    {passwordRecovery && <InlineMessage tone="info">Elige una nueva contraseña para completar la recuperación de tu cuenta.</InlineMessage>}
    <section className="card max-w-2xl">
      <div className="mb-5 flex items-center gap-3"><UserRound className="text-brand-blue" /><h3 className="font-bold">Datos de la cuenta</h3></div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Nombre</dt><dd className="mt-1 font-medium">{user?.name}</dd></div>
        <div><dt className="text-xs text-slate-500">Correo</dt><dd className="mt-1 font-medium">{user?.email}</dd></div>
        <div><dt className="text-xs text-slate-500">Rol</dt><dd className="mt-1 font-medium">{user?.role}</dd></div>
      </dl>
    </section>
    <section className="card max-w-2xl">
      <div className="mb-5 flex items-center gap-3"><KeyRound className="text-brand-blue" /><div><h3 className="font-bold">Cambiar contraseña</h3><p className="text-sm text-slate-500">Usa al menos 8 caracteres.</p></div></div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nueva contraseña"><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <Field label="Confirmar contraseña"><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
        <button className="btn-primary" disabled={busy}>{busy ? 'Actualizando...' : 'Actualizar contraseña'}</button>
      </form>
    </section>
  </div>;
}
