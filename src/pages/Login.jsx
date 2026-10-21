import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { InlineMessage } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { login, logout, sendPasswordRecovery, configurationError } = useAuth();
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const res = await login(email, password);
      if (!res.success) setError(res.message);
    } catch (loginError) {
      console.error('Error inesperado al iniciar sesión:', loginError);
      setError(loginError.message || 'Ocurrió un error al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  const handleRecovery = async () => {
    if (!email.trim()) {
      setError('Escribe tu correo para enviarte el enlace de recuperación.');
      return;
    }
    setCargando(true);
    setError('');
    setNotice('');
    try {
      const result = await sendPasswordRecovery(email);
      if (result.success) setNotice('Si el correo está registrado, recibirás un enlace para recuperar el acceso.');
      else setError(result.message);
    } catch (recoveryError) {
      setError(recoveryError.message || 'No se pudo solicitar la recuperación.');
    } finally {
      setCargando(false);
    }
  };

  const handleClearSession = async () => {
    const result = await logout();
    if (!result?.success) setError(result?.message || 'No se pudo cerrar la sesión actual.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="text-brand-blue text-5xl mb-4">❄️</div>
        <h2 className="text-3xl font-extrabold text-brand-dark">CoolAceGest</h2>
        <p className="mt-2 text-sm text-slate-600">Gestión de servicios y refrigeración vehicular</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <InlineMessage>{configurationError || error}</InlineMessage>
            <InlineMessage tone="success">{notice}</InlineMessage>
            <div><label htmlFor="login-email" className="block text-sm font-medium">Correo</label><input id="login-email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 input-field" placeholder="nombre@empresa.com" /></div>
            <div><label htmlFor="login-password" className="block text-sm font-medium">Contraseña</label><input id="login-password" autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 input-field" /></div>
            <button type="submit" disabled={cargando} className="w-full btn-primary py-3">{cargando ? 'Conectando...' : 'Ingresar'}</button>
            <button type="button" onClick={handleRecovery} disabled={cargando} className="w-full text-sm font-medium text-brand-blue hover:underline disabled:opacity-50">¿Olvidaste tu contraseña?</button>
            {configurationError && <button type="button" onClick={handleClearSession} disabled={cargando} className="w-full text-sm text-slate-500 hover:underline">Cerrar sesión actual</button>}
          </form>
        </div>
      </div>
    </div>
  );
}