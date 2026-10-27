import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    localStorage.removeItem('refrig_user');
    if (!isSupabaseConfigured) {
      setConfigurationError('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env y reinicia la aplicación.');
      setLoading(false);
      return undefined;
    }

    let active = true;

    const loadProfile = (authUser) => supabase
      .from('profiles')
      .select('id, name, role, cliente_id, activo')
      .eq('id', authUser.id)
      .maybeSingle();

    let profileLoadId = 0;
    let loadedAuthUserId = null;
    let profileRequest = null;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      const requestId = ++profileLoadId;
      const authUser = session?.user ?? null;
      if (authUser?.id === loadedAuthUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      window.setTimeout(() => {
        if (!active || requestId !== profileLoadId) return;
        if (!authUser) {
          loadedAuthUserId = null;
          setUser(null);
          setConfigurationError('');
          setLoading(false);
          return;
        }
        const request = profileRequest?.userId === authUser.id
          ? profileRequest.promise
          : loadProfile(authUser);
        if (profileRequest?.userId !== authUser.id) {
          profileRequest = { userId: authUser.id, promise: request };
        }
        request
          .then(({ data: profile, error }) => {
            if (!active || requestId !== profileLoadId) return;
            if (error) {
              console.error('No se pudo cargar el perfil de usuario:', error);
              setConfigurationError('No se pudo cargar tu perfil. Verifica que aplicaste la migración de base de datos y que tu usuario tenga un perfil.');
              setUser(null);
              return;
            }
            if (!profile) {
              setConfigurationError('Tu cuenta de acceso no tiene un perfil asignado. Solicita al administrador que complete tu perfil en Supabase.');
              setUser(null);
              return;
            }
            if (!profile.activo) {
              setConfigurationError('Tu cuenta está desactivada. Contacta al administrador del sistema.');
              setUser(null);
              return;
            }

            setConfigurationError('');
            setUser({
              id: authUser.id,
              email: authUser.email,
              name: profile.name || authUser.user_metadata?.name || authUser.email,
              role: profile.role,
              clienteId: profile.cliente_id,
            });
            loadedAuthUserId = authUser.id;
          })
          .catch((error) => {
            console.error('No se pudo cargar el perfil de la sesión:', error);
            if (active && requestId === profileLoadId) {
              setConfigurationError('No se pudo cargar tu perfil de usuario.');
            }
          })
          .finally(() => {
            if (profileRequest?.promise === request) profileRequest = null;
            if (active && requestId === profileLoadId) {
              setLoading(false);
            }
          });
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Falta configurar la conexión a Supabase en .env.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error('Error al iniciar sesión en Supabase:', error);
      if (error.message === 'Invalid login credentials') {
        return { success: false, message: 'Correo o contraseña incorrectos. Verifica que la cuenta esté creada en Authentication > Users de Supabase.' };
      }
      return { success: false, message: `No se pudo iniciar sesión: ${error.message}` };
    }

    if (!data.user) return { success: false, message: 'Supabase no devolvió una cuenta de usuario.' };
    return { success: true };
  };

  const logout = async () => {
    if (!supabase) return { success: false, message: 'Supabase no está configurado.' };
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('No se pudo cerrar la sesión de Supabase:', error);
        return { success: false, message: 'No se pudo cerrar la sesión. Intenta nuevamente.' };
      }
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('No se pudo cerrar la sesión de Supabase:', error);
      return { success: false, message: 'No se pudo cerrar la sesión. Intenta nuevamente.' };
    }
  };

  const sendPasswordRecovery = async (email) => {
    if (!supabase) return { success: false, message: 'Supabase no está configurado.' };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) {
        console.error('No se pudo enviar el correo de recuperación:', error);
        return { success: false, message: `No se pudo enviar el correo: ${error.message}` };
      }
      return { success: true };
    } catch (error) {
      console.error('No se pudo enviar el correo de recuperación:', error);
      return { success: false, message: 'No se pudo solicitar la recuperación. Verifica la conexión y la configuración de correo.' };
    }
  };

  const updatePassword = async (password) => {
    if (!supabase) return { success: false, message: 'Supabase no está configurado.' };
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('No se pudo actualizar la contraseña:', error);
        return { success: false, message: `No se pudo actualizar la contraseña: ${error.message}` };
      }
      setPasswordRecovery(false);
      return { success: true };
    } catch (error) {
      console.error('No se pudo actualizar la contraseña:', error);
      return { success: false, message: 'No se pudo actualizar la contraseña. Intenta nuevamente.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, sendPasswordRecovery, updatePassword, loading, configurationError, passwordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
