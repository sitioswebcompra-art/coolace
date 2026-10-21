import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../supabase';

const DataContext = createContext(null);
const emptyData = {
  clientes: [],
  vehiculos: [],
  ordenes: [],
  tecnicos: [],
  informes: [],
  cotizaciones: [],
  cotizacionItems: [],
  repuestos: [],
  notificaciones: [],
  activity: [],
  companySettings: null,
  profiles: [],
};

const deletableRecords = {
  clientes: { key: 'clientes', entity: 'cliente', idColumn: 'id' },
  vehiculos: { key: 'vehiculos', entity: 'vehículo', idColumn: 'id' },
  ordenes: { key: 'ordenes', entity: 'orden', idColumn: 'id' },
  cotizaciones: { key: 'cotizaciones', entity: 'cotización', idColumn: 'id' },
  informes_tecnicos: { key: 'informes', entity: 'informe técnico', idColumn: 'id' },
  tecnicos: { key: 'tecnicos', entity: 'técnico', idColumn: 'id' },
  repuestos: { key: 'repuestos', entity: 'repuesto', idColumn: 'id' },
};

const getErrorMessage = (error) => {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Faltan tablas de la base de datos. Ejecuta database.sql en el SQL Editor del proyecto Supabase.';
  }
  if (error?.code === '42501' || error?.code === 'PGRST301') {
    return 'No tienes permisos para esta operación. Revisa la sesión y las políticas RLS de Supabase.';
  }
  if (error?.code === '23503') {
    return 'No se puede eliminar este registro porque tiene datos relacionados. Elimina o reasigna esos registros primero.';
  }
  return error?.message || 'Ocurrió un error al comunicarse con Supabase.';
};

export const DataProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(emptyData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dataError, setDataError] = useState('');

  const refreshData = useCallback(async () => {
    if (!user || !isSupabaseConfigured || !supabase) {
      setData(emptyData);
      setDataError('');
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    setDataError('');
    const queries = [
      ['clientes', supabase.from('clientes').select('*').order('created_at', { ascending: false })],
      ['vehiculos', supabase.from('vehiculos').select('*').order('created_at', { ascending: false })],
      ['ordenes', supabase.from('ordenes').select('*').order('created_at', { ascending: false })],
      ['tecnicos', supabase.from('tecnicos').select('*').order('nombre')],
      ['informes', supabase.from('informes_tecnicos').select('*').order('created_at', { ascending: false })],
      ['cotizaciones', supabase.from('cotizaciones').select('*').order('created_at', { ascending: false })],
      ['cotizacionItems', supabase.from('cotizacion_items').select('*').order('id')],
      ['repuestos', supabase.from('repuestos').select('*').order('nombre')],
      ['notificaciones', supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(50)],
      ...(user.role === 'Administrador' ? [['profiles', supabase.from('profiles').select('id, name, email, role, cliente_id, activo, created_at').order('name')]] : []),
      ...(user.role === 'Cliente' ? [] : [['activity', supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200)]]),
      ['companySettings', supabase.from('company_settings').select('*').maybeSingle()],
    ];

    try {
      const results = await Promise.all(queries.map(([, query]) => query));
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        console.error('Error cargando datos de Supabase:', failed.error);
        setDataError(getErrorMessage(failed.error));
      }

      const nextData = {};
      queries.forEach(([key], index) => {
        const result = results[index];
        nextData[key] = result?.error ? (key === 'companySettings' ? null : []) : (result?.data ?? (key === 'companySettings' ? null : []));
      });
      setData(nextData);
    } catch (error) {
      console.error('Error cargando datos de Supabase:', error);
      setDataError(getErrorMessage(error));
      setData(emptyData);
    } finally {
      setIsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) refreshData();
  }, [authLoading, refreshData]);

  const saveRecord = async (table, record, currentRecords, setRecords) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const query = record.id
      ? supabase.from(table).update(record).eq('id', record.id).select().single()
      : supabase.from(table).insert(record).select().single();
    const { data: saved, error } = await query;
    if (error) {
      console.error(`Error guardando registro en ${table}:`, error);
      throw new Error(getErrorMessage(error));
    }
    setRecords(record.id
      ? currentRecords.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...currentRecords]);
    return saved;
  };

  const saveCliente = async (record) => {
    const saved = await saveRecord('clientes', record, data.clientes, (clientes) => setData((current) => ({ ...current, clientes })));
    await logActivity({ entidad: 'cliente', entidad_id: String(saved.id), accion: record.id ? 'actualizado' : 'creado', descripcion: `Se ${record.id ? 'actualizó' : 'creó'} el cliente ${saved.nombre}.`, cliente_id: saved.id });
    return saved;
  };
  const saveVehiculo = async (record) => {
    const saved = await saveRecord('vehiculos', record, data.vehiculos, (vehiculos) => setData((current) => ({ ...current, vehiculos })));
    await logActivity({ entidad: 'vehículo', entidad_id: String(saved.id), accion: record.id ? 'actualizado' : 'creado', descripcion: `Se ${record.id ? 'actualizó' : 'registró'} el vehículo ${saved.patente}.`, cliente_id: saved.clienteId, vehiculo_id: saved.id });
    return saved;
  };
  const saveTecnico = (record) => saveRecord('tecnicos', record, data.tecnicos, (tecnicos) => setData((current) => ({ ...current, tecnicos })));
  const saveRepuesto = (record) => saveRecord('repuestos', record, data.repuestos, (repuestos) => setData((current) => ({ ...current, repuestos })));
  const saveInforme = async (record) => {
    const saved = await saveRecord('informes_tecnicos', record, data.informes, (informes) => setData((current) => ({ ...current, informes })));
    await logActivity({ entidad: 'informe', entidad_id: String(saved.id), accion: saved.estado, descripcion: `Informe ${saved.estado.toLowerCase()} de la orden ${saved.orden_id}.`, orden_id: saved.orden_id });
    return saved;
  };
  const saveCotizacion = async (record) => {
    const saved = await saveRecord('cotizaciones', record, data.cotizaciones, (cotizaciones) => setData((current) => ({ ...current, cotizaciones })));
    await logActivity({ entidad: 'cotización', entidad_id: saved.numero, accion: record.id ? saved.estado : 'creada', descripcion: `Cotización ${saved.numero}: ${saved.estado}.`, cliente_id: saved.clienteId, vehiculo_id: saved.vehiculoId, orden_id: saved.orden_id });
    return saved;
  };

  const addOrden = async (record) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const id = `OT-${Date.now().toString(36).toUpperCase()}`;
    const { data: saved, error } = await supabase
      .from('ordenes')
      .insert({ ...record, id, created_by: user.id })
      .select()
      .single();
    if (error) {
      console.error('Error creando orden de trabajo:', error);
      throw new Error(getErrorMessage(error));
    }
    setData((current) => ({ ...current, ordenes: [saved, ...current.ordenes] }));
    await logActivity({ entidad: 'orden', entidad_id: id, accion: 'creada', descripcion: `Se creó la orden ${id}.`, cliente_id: record.clienteId, vehiculo_id: record.vehiculoId, orden_id: id });
    return saved;
  };

  const updateOrdenEstado = async (id, estado) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: updated, error } = await supabase
      .from('ordenes')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error actualizando el estado de la orden:', error);
      throw new Error(getErrorMessage(error));
    }
    setData((current) => ({ ...current, ordenes: current.ordenes.map((order) => order.id === id ? updated : order) }));
    await logActivity({ entidad: 'orden', entidad_id: id, accion: 'estado actualizado', descripcion: `La orden ${id} cambió a estado ${estado}.`, cliente_id: updated.clienteId, vehiculo_id: updated.vehiculoId, orden_id: id });
    return updated;
  };

  const updateOrden = async (id, record) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: updated, error } = await supabase
      .from('ordenes')
      .update({ ...record, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error actualizando la orden de trabajo:', error);
      throw new Error(getErrorMessage(error));
    }
    setData((current) => ({ ...current, ordenes: current.ordenes.map((order) => order.id === id ? updated : order) }));
    await logActivity({
      entidad: 'orden',
      entidad_id: id,
      accion: 'reprogramada o reasignada',
      descripcion: `Se actualizó la agenda de la orden ${id}.`,
      cliente_id: updated.clienteId,
      vehiculo_id: updated.vehiculoId,
      orden_id: id,
    });
    return updated;
  };

  const convertQuoteToOrder = async (quoteId, schedule) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: order, error } = await supabase.rpc('convert_quote_to_order', {
      p_quote_id: quoteId,
      p_scheduled_date: schedule.fecha,
      p_start_time: schedule.hora_inicio || null,
      p_technician_id: schedule.tecnico_id || null,
      p_service_address: schedule.direccion || null,
      p_service_zone: schedule.zona || null,
      p_service_priority: schedule.prioridad || 'Normal',
    });
    if (error) {
      console.error('No se pudo convertir la cotización en una orden:', error);
      throw new Error(getErrorMessage(error));
    }
    await refreshData();
    return order;
  };

  const logActivity = async (activity) => {
    if (!supabase || !user) return;
    const { data: saved, error } = await supabase.from('activity_logs').insert({ ...activity, user_id: user.id }).select().single();
    if (error) {
      console.error('No se pudo guardar la actividad:', error);
      return;
    }
    setData((current) => ({ ...current, activity: [saved, ...(current.activity || [])].slice(0, 200) }));
  };

  const deleteRecord = async (table, id) => {
    const target = deletableRecords[table];
    if (!target) throw new Error('Este tipo de registro no se puede eliminar.');
    if (user?.role !== 'Administrador') throw new Error('Solo un administrador puede eliminar registros.');
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { error } = await supabase.from(table).delete().eq(target.idColumn, id).select(target.idColumn).single();
    if (error) {
      console.error(`Error eliminando registro de ${table}:`, error);
      throw new Error(getErrorMessage(error));
    }

    setData((current) => ({
      ...current,
      [target.key]: current[target.key].filter((record) => record.id !== id),
    }));
    await logActivity({
      entidad: target.entity,
      entidad_id: String(id),
      accion: 'eliminado',
      descripcion: `Se eliminó el registro ${id} (${target.entity}).`,
    });
  };

  const markNotificationRead = async (id) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    if (error) {
      console.error('No se pudo marcar la notificación como leída:', error);
      throw new Error(getErrorMessage(error));
    }
    setData((current) => ({
      ...current,
      notificaciones: current.notificaciones.map((item) => item.id === id ? { ...item, leida: true } : item),
    }));
  };

  const saveCompanySettings = async (settings) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: saved, error } = await supabase
      .from('company_settings')
      .upsert({ ...settings, id: 1, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) {
      console.error('Error guardando la configuración de la empresa:', error);
      throw new Error(getErrorMessage(error));
    }
    setData((current) => ({ ...current, companySettings: saved }));
    return saved;
  };

  const saveUserAccess = async ({ userId, role, active, clienteId = null, tecnicoId = null }) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: saved, error } = await supabase.rpc('admin_update_user_access', {
      p_user_id: userId,
      p_role: role,
      p_activo: active,
      p_cliente_id: clienteId ? Number(clienteId) : null,
      p_tecnico_id: tecnicoId ? Number(tecnicoId) : null,
    });
    if (error) {
      console.error('No se pudieron actualizar los permisos del usuario:', error);
      throw new Error(getErrorMessage(error));
    }
    await refreshData();
    return saved;
  };

  return (
    <DataContext.Provider value={{
      data, isLoaded, dataError, refreshData, saveCliente, saveVehiculo, saveTecnico,
      saveRepuesto, saveInforme, saveCotizacion, addOrden, updateOrdenEstado, updateOrden, convertQuoteToOrder,
      logActivity, deleteRecord, markNotificationRead, saveCompanySettings, saveUserAccess,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
