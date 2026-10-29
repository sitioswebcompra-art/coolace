import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../supabase';

const DataContext = createContext(null);
const backgroundSyncInterval = 5 * 60_000;
const queryCacheDuration = 30_000;
const tablesByPath = {
  '/': ['clientes', 'vehiculos', 'ordenes', 'informes', 'cotizaciones'],
  '/clientes': ['clientes', 'vehiculos'],
  '/vehiculos': ['clientes', 'vehiculos'],
  '/agenda': ['clientes', 'vehiculos', 'ordenes', 'tecnicos'],
  '/tecnicos': ['ordenes', 'tecnicos'],
  '/informes': ['clientes', 'vehiculos', 'ordenes', 'informes'],
  '/cotizaciones': ['clientes', 'vehiculos', 'ordenes', 'tecnicos', 'informes', 'cotizaciones', 'cotizacionItems', 'repuestos', 'companySettings'],
  '/inventario': ['repuestos'],
  '/historial': ['clientes', 'vehiculos', 'ordenes', 'informes', 'cotizaciones', 'activity'],
  '/reportes': ['clientes', 'vehiculos', 'ordenes', 'informes', 'cotizaciones'],
  '/configuracion': ['companySettings'],
  '/usuarios': ['clientes', 'tecnicos', 'profiles'],
  '/papelera': ['clientes', 'vehiculos', 'ordenes', 'tecnicos', 'informes', 'cotizaciones', 'cotizacionItems', 'repuestos'],
  '/perfil': [],
  '/login': [],
  '/acceso-denegado': [],
};
const tableNames = {
  clientes: 'clientes',
  vehiculos: 'vehiculos',
  ordenes: 'ordenes',
  tecnicos: 'tecnicos',
  informes: 'informes_tecnicos',
  cotizaciones: 'cotizaciones',
  cotizacionItems: 'cotizacion_items',
  repuestos: 'repuestos',
  notificaciones: 'notificaciones',
  profiles: 'profiles',
  activity: 'activity_logs',
  companySettings: 'company_settings',
};
const queryKeysByTable = Object.fromEntries(
  Object.entries(tableNames).map(([key, table]) => [table, key]),
);
const getQueryCacheKey = (userId, table) => `coolace:v1:${userId}:${table}`;
const selectColumnsByTable = {
  clientes: 'id, tipo, nombre, rut, contacto, telefono, email, direccion, comuna, ciudad, condiciones_pago, notas, estado, created_at, updated_at, archived_at',
  vehiculos: 'id, patente, marca, modelo, clienteId, estado, anio, vin, tipo_vehiculo, kilometraje, equipo_marca, equipo_modelo, refrigerante, capacidad_enfriamiento, horas_uso, tipo_sistema, numero_serie_equipo, fecha_instalacion, ultimo_mantenimiento, proximo_mantenimiento, observaciones, updated_at, archived_at',
  ordenes: 'id, vehiculoId, clienteId, servicio, estado, fecha, tecnico, descripcion, direccion, hora_inicio, duracion_estimada, tecnico_id, zona, prioridad, observaciones, created_at, updated_at, archived_at',
  tecnicos: 'id, user_id, nombre, telefono, email, especialidad, zona, estado, archived_at',
  informes_tecnicos: 'id, orden_id, estado, llegada, termino, ubicacion, tipo_trabajo, checklist, mediciones, diagnostico, fallas, repuestos, materiales, archivos, observaciones, recomendaciones, firma_path, created_at, updated_at, archived_at',
  cotizaciones: 'id, numero, orden_id, informe_id, clienteId, vehiculoId, estado, fecha_emision, fecha_vencimiento, mano_obra, descuento, impuestos, total_neto, total, condiciones_pago, tiempo_estimado, garantia, observaciones, created_at, updated_at, archived_at',
  cotizacion_items: 'id, cotizacion_id, repuesto_id, descripcion, cantidad, precio_unitario, impuesto, tipo',
  repuestos: 'id, codigo, nombre, categoria, marca, descripcion, precio_compra, precio_venta, impuesto, stock, unidad, estado, observaciones, archived_at',
  notificaciones: 'id, titulo, mensaje, leida, enlace, created_at',
  activity_logs: 'id, cliente_id, vehiculo_id, orden_id, entidad, entidad_id, accion, descripcion, created_at',
  company_settings: 'id, nombre, rut, direccion, telefono, email, logo_url, impuesto, condiciones_pago',
  profiles: 'id, name, email, role, cliente_id, activo, created_at',
};
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

const archivableRecords = {
  clientes: { key: 'clientes', entity: 'cliente', idColumn: 'id' },
  vehiculos: { key: 'vehiculos', entity: 'vehículo', idColumn: 'id' },
  ordenes: { key: 'ordenes', entity: 'orden', idColumn: 'id' },
  cotizaciones: { key: 'cotizaciones', entity: 'cotización', idColumn: 'id' },
  informes_tecnicos: { key: 'informes', entity: 'informe técnico', idColumn: 'id' },
  tecnicos: { key: 'tecnicos', entity: 'técnico', idColumn: 'id' },
  repuestos: { key: 'repuestos', entity: 'repuesto', idColumn: 'id' },
};

const relatedTableLabels = {
  clientes: 'Clientes',
  cotizacion_items: 'líneas de cotización',
  cotizaciones: 'Cotizaciones',
  informes_tecnicos: 'Informes técnicos',
  ordenes: 'órdenes de trabajo',
  profiles: 'Usuarios',
  vehiculos: 'Vehículos',
};

const getRelatedReference = (error) => {
  const referencingTable = error?.details?.match(/referenced from table "([^"]+)"/i)?.[1]
    || error?.message?.match(/foreign key constraint "[^"]+" on table "([^"]+)"/i)?.[1];
  const constraint = error?.constraint
    || error?.message?.match(/foreign key constraint "([^"]+)"/i)?.[1];
  if (!referencingTable) return null;

  let field = null;
  if (typeof constraint === 'string') {
    const prefix = `${referencingTable}_`;
    const suffix = '_fkey';
    if (constraint.startsWith(prefix) && constraint.endsWith(suffix)) {
      field = constraint.slice(prefix.length, -suffix.length) || field;
    }
  }

  return {
    table: referencingTable,
    tableLabel: relatedTableLabels[referencingTable] || referencingTable,
    field: field || null,
  };
};

const getErrorMessage = (error) => {
  if (error?.code === 'PGRST202') {
    return 'Supabase no encuentra la función load_data_bundle. Ejecuta el database.sql actualizado en el SQL Editor del proyecto y vuelve a cargar la aplicación. Si ya lo ejecutaste, actualiza el esquema de la API en Supabase y vuelve a intentarlo.';
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Faltan tablas de la base de datos. Ejecuta database.sql en el SQL Editor del proyecto Supabase.';
  }
  if (error?.code === '42703') {
    return 'Falta actualizar la estructura de la base de datos. Ejecuta database.sql en el SQL Editor del proyecto Supabase.';
  }
  if (error?.code === '42501' || error?.code === 'PGRST301') {
    return 'No tienes permisos para esta operación. Revisa la sesión y las políticas RLS de Supabase.';
  }
  if (error?.code === '23503') {
    const related = getRelatedReference(error);
    if (related) {
      const fieldMessage = related.field ? ` mediante el campo ${related.field}` : '';
      return `No se puede eliminar permanentemente: hay registros de ${related.tableLabel} vinculados${fieldMessage}. Resuelve esa relación y vuelve a intentarlo. Si el registro relacionado está archivado, elimínalo primero desde Papelera.`;
    }
    return 'No se puede eliminar permanentemente porque hay otros registros relacionados. Revisa los registros vinculados y vuelve a intentarlo.';
  }
  return error?.message || 'Ocurrió un error al comunicarse con Supabase.';
};

export const DataProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const activeTables = useMemo(() => {
    const pageTables = (tablesByPath[pathname] || tablesByPath['/']).map((key) => tableNames[key]);
    const showApplicationShell = pathname !== '/login' && pathname !== '/acceso-denegado';
    return showApplicationShell ? [...pageTables, tableNames.notificaciones] : pageTables;
  }, [pathname]);
  const [data, setData] = useState(emptyData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dataError, setDataError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const realtimeRefreshTimeout = useRef(null);
  const dataRefreshId = useRef(0);
  const tableRefreshIds = useRef({});
  const inFlightQueries = useRef(new Map());
  const queryCache = useRef(new Map());
  const realtimeConnected = useRef(false);
  const dataUserId = useRef(null);

  const invalidateTableCache = useCallback((table) => {
    const key = queryKeysByTable[table];
    if (!key || !user) return;
    queryCache.current.delete(getQueryCacheKey(user.id, table));
    tableRefreshIds.current[key] = (tableRefreshIds.current[key] || 0) + 1;
    inFlightQueries.current.clear();
  }, [user]);

  const refreshData = useCallback(async ({ silent = false, tables = activeTables, force = false } = {}) => {
    const isFullRefresh = !tables;
    const refreshId = silent ? null : ++dataRefreshId.current;
    if (!user || !isSupabaseConfigured || !supabase) {
      Object.keys(tableRefreshIds.current).forEach((key) => {
        tableRefreshIds.current[key] += 1;
      });
      queryCache.current.clear();
      inFlightQueries.current.clear();
      dataUserId.current = null;
      setData(emptyData);
      setDataError('');
      setRealtimeError('');
      setIsLoaded(true);
      return;
    }

    if (dataUserId.current !== user.id) {
      dataUserId.current = user.id;
      Object.keys(tableRefreshIds.current).forEach((key) => {
        tableRefreshIds.current[key] += 1;
      });
      queryCache.current.clear();
      inFlightQueries.current.clear();
      setData(emptyData);
    }

    setDataError('');
    if (user.role !== 'Administrador') {
      tableRefreshIds.current.profiles = (tableRefreshIds.current.profiles || 0) + 1;
    }
    if (user.role === 'Cliente') {
      tableRefreshIds.current.activity = (tableRefreshIds.current.activity || 0) + 1;
    }
    const queryDefinitions = [
      ['clientes', 'clientes'],
      ['vehiculos', 'vehiculos'],
      ['ordenes', 'ordenes'],
      ['tecnicos', 'tecnicos'],
      ['informes', 'informes_tecnicos'],
      ['cotizaciones', 'cotizaciones'],
      ['cotizacionItems', 'cotizacion_items'],
      ['repuestos', 'repuestos'],
      ['notificaciones', 'notificaciones'],
      ...(user.role === 'Administrador' ? [['profiles', 'profiles']] : []),
      ...(user.role === 'Cliente' ? [] : [['activity', 'activity_logs']]),
      ['companySettings', 'company_settings'],
    ];
    const queries = queryDefinitions.filter(([, table]) => (!tables || tables.includes(table))
      && (force || Date.now() - (queryCache.current.get(getQueryCacheKey(user.id, table)) || 0) >= queryCacheDuration));

    if (!silent && queries.length) setIsLoaded(false);

    try {
      const requestIds = queries.map(([key]) => {
        const requestId = (tableRefreshIds.current[key] || 0) + 1;
        tableRefreshIds.current[key] = requestId;
        return requestId;
      });
      const requestedTables = queries.map(([, table]) => table);
      const requestKey = `bundle:${[...requestedTables].sort().join(',')}`;
      const existing = inFlightQueries.current.get(requestKey);
      let requestPromise = existing?.userId === user.id && !force ? existing.promise : null;
      if (!requestPromise) {
        const entry = {
          userId: user.id,
          promise: supabase.rpc('load_data_bundle', { p_tables: requestedTables }),
        };
        inFlightQueries.current.set(requestKey, entry);
        entry.promise.then(
          () => {
            if (inFlightQueries.current.get(requestKey) === entry) inFlightQueries.current.delete(requestKey);
          },
          () => {
            if (inFlightQueries.current.get(requestKey) === entry) inFlightQueries.current.delete(requestKey);
          },
        );
        requestPromise = entry.promise;
      }
      const result = await requestPromise;
      const updates = {
        ...(user.role !== 'Administrador' ? { profiles: [] } : {}),
        ...(user.role === 'Cliente' ? { activity: [] } : {}),
      };
      if (result?.error) {
        queries.forEach(([key, table], index) => {
          if (tableRefreshIds.current[key] !== requestIds[index]) return;
          queryCache.current.delete(getQueryCacheKey(user.id, table));
          if (isFullRefresh) updates[key] = key === 'companySettings' ? null : [];
        });
        console.error('Error cargando datos de Supabase:', result.error);
        setDataError(getErrorMessage(result.error));
      } else {
        queries.forEach(([key, table], index) => {
          if (tableRefreshIds.current[key] !== requestIds[index]) return;
          queryCache.current.set(getQueryCacheKey(user.id, table), Date.now());
          updates[key] = result?.data?.[key] ?? (key === 'companySettings' ? null : []);
        });
      }
      setData((current) => ({ ...current, ...updates }));
    } catch (error) {
      console.error('Error cargando datos de Supabase:', error);
      setDataError(getErrorMessage(error));
    } finally {
      if (refreshId === dataRefreshId.current) setIsLoaded(true);
    }
  }, [activeTables, user]);

  useEffect(() => {
    if (!authLoading) refreshData();
  }, [authLoading, refreshData]);

  useEffect(() => {
    if (authLoading || !user || !supabase) {
      setRealtimeError('');
      return undefined;
    }

    const tables = activeTables.filter((table) => (
      (table !== 'profiles' || user.role === 'Administrador')
      && (table !== 'activity_logs' || user.role !== 'Cliente')
    ));
    const pendingTables = new Set();
    let hasConnected = false;
    let lastFallbackSync = Date.now();
    const scheduleSilentRefresh = (table = null) => {
      (table ? [table] : tables).forEach((changedTable) => {
        invalidateTableCache(changedTable);
        pendingTables.add(changedTable);
      });
      if (realtimeRefreshTimeout.current) {
        window.clearTimeout(realtimeRefreshTimeout.current);
      }
      realtimeRefreshTimeout.current = window.setTimeout(() => {
        const changedTables = [...pendingTables];
        pendingTables.clear();
        refreshData({ silent: true, tables: changedTables, force: true });
      }, 150);
    };
    const channel = supabase.channel(`data-changes-${user.id}`);
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        scheduleSilentRefresh(table);
      });
    });

    const subscription = channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        const reconnected = hasConnected;
        hasConnected = true;
        realtimeConnected.current = true;
        setRealtimeError('');
        if (reconnected) scheduleSilentRefresh();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeConnected.current = false;
        console.error('No se pudo establecer la suscripción en tiempo real de Supabase:', error || status);
        setRealtimeError('La actualización en tiempo real no está disponible. Ejecuta database.sql en Supabase y verifica que Realtime esté habilitado.');
      } else if (status === 'CLOSED') {
        realtimeConnected.current = false;
      }
    });

    const syncWhenVisible = () => {
      const now = Date.now();
      if (
        document.visibilityState === 'visible'
        && !realtimeConnected.current
        && now - lastFallbackSync >= backgroundSyncInterval
      ) {
        lastFallbackSync = now;
        scheduleSilentRefresh();
      }
    };
    const syncInterval = window.setInterval(syncWhenVisible, backgroundSyncInterval);
    document.addEventListener('visibilitychange', syncWhenVisible);
    window.addEventListener('focus', syncWhenVisible);

    return () => {
      window.clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      window.removeEventListener('focus', syncWhenVisible);
      if (realtimeRefreshTimeout.current) {
        window.clearTimeout(realtimeRefreshTimeout.current);
        realtimeRefreshTimeout.current = null;
      }
      realtimeConnected.current = false;
      supabase.removeChannel(subscription);
    };
  }, [activeTables, authLoading, user, refreshData, invalidateTableCache]);

  const saveRecord = async (table, record, currentRecords, setRecords) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const query = record.id
      ? supabase.from(table).update(record).eq('id', record.id).select(selectColumnsByTable[table]).single()
      : supabase.from(table).insert(record).select(selectColumnsByTable[table]).single();
    const { data: saved, error } = await query;
    if (error) {
      console.error(`Error guardando registro en ${table}:`, error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache(table);
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
      .select(selectColumnsByTable.ordenes)
      .single();
    if (error) {
      console.error('Error creando orden de trabajo:', error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache('ordenes');
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
      .select(selectColumnsByTable.ordenes)
      .single();
    if (error) {
      console.error('Error actualizando el estado de la orden:', error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache('ordenes');
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
      .select(selectColumnsByTable.ordenes)
      .single();
    if (error) {
      console.error('Error actualizando la orden de trabajo:', error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache('ordenes');
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
    await refreshData({ force: true });
    return order;
  };

  const logActivity = async (activity) => {
    if (!supabase || !user) return;
    const { data: saved, error } = await supabase.from('activity_logs').insert({ ...activity, user_id: user.id }).select(selectColumnsByTable.activity_logs).single();
    if (error) {
      console.error('No se pudo guardar la actividad:', error);
      return;
    }
    invalidateTableCache('activity_logs');
    setData((current) => ({ ...current, activity: [saved, ...(current.activity || [])].slice(0, 200) }));
  };

  const archiveRecord = async (table, id) => {
    const target = archivableRecords[table];
    if (!target) throw new Error('Este tipo de registro no se puede archivar.');
    if (user?.role !== 'Administrador') throw new Error('Solo un administrador puede archivar registros.');
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { data: updated, error } = await supabase.from(table)
      .update({ archived_at: new Date().toISOString() })
      .eq(target.idColumn, id)
      .select(selectColumnsByTable[table])
      .single();
    if (error) {
      console.error(`Error archivando registro de ${table}:`, error);
      throw new Error(getErrorMessage(error));
    }

    invalidateTableCache(table);
    setData((current) => ({
      ...current,
      [target.key]: current[target.key].map((record) => record.id === id ? updated : record),
    }));
    await logActivity({
      entidad: target.entity,
      entidad_id: String(id),
      accion: 'archivado',
      descripcion: `Se archivó el registro ${id} (${target.entity}).`,
    });
  };

  const restoreRecord = async (table, id) => {
    const target = archivableRecords[table];
    if (!target) throw new Error('Este tipo de registro no se puede restaurar.');
    if (user?.role !== 'Administrador') throw new Error('Solo un administrador puede restaurar registros.');
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { data: updated, error } = await supabase.from(table)
      .update({ archived_at: null })
      .eq(target.idColumn, id)
      .select(selectColumnsByTable[table])
      .single();
    if (error) {
      console.error(`Error restaurando registro de ${table}:`, error);
      throw new Error(getErrorMessage(error));
    }

    invalidateTableCache(table);
    setData((current) => ({
      ...current,
      [target.key]: current[target.key].map((record) => record.id === id ? updated : record),
    }));
    await logActivity({
      entidad: target.entity,
      entidad_id: String(id),
      accion: 'restaurado',
      descripcion: `Se restauró el registro ${id} (${target.entity}).`,
    });
  };

  const permanentlyDeleteRecord = async (table, id) => {
    const target = archivableRecords[table];
    if (!target) throw new Error('Este tipo de registro no se puede eliminar permanentemente.');
    if (user?.role !== 'Administrador') throw new Error('Solo un administrador puede eliminar registros permanentemente.');
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { data: deleted, error } = await supabase.from(table)
      .delete()
      .eq(target.idColumn, id)
      .not('archived_at', 'is', null)
      .select(target.idColumn)
      .maybeSingle();
    if (error) {
      console.error(`Error eliminando permanentemente registro de ${table}:`, error);
      if (error.code === '23503') await refreshData({ silent: true, force: true });
      throw new Error(getErrorMessage(error));
    }
    if (!deleted) throw new Error('El registro ya no está en la papelera. Actualiza la página e inténtalo de nuevo.');

    invalidateTableCache(table);
    setData((current) => ({
      ...current,
      [target.key]: current[target.key].filter((record) => String(record.id) !== String(id)),
    }));
    await logActivity({
      entidad: target.entity,
      entidad_id: String(id),
      accion: 'eliminado permanentemente',
      descripcion: `Se eliminó permanentemente el registro ${id} (${target.entity}).`,
    });
  };

  const permanentlyDeleteQuoteLines = async (quoteId) => {
    if (user?.role !== 'Administrador') throw new Error('Solo un administrador puede eliminar líneas de cotización.');
    if (!supabase) throw new Error('Supabase no está configurado.');
    const quote = data.cotizaciones.find((item) => String(item.id) === String(quoteId));
    if (!quote?.archived_at) throw new Error('Primero archiva la cotización antes de eliminar sus líneas.');
    const expectedCount = data.cotizacionItems.filter((item) => String(item.cotizacion_id) === String(quoteId)).length;

    const { data: deletedLines, error } = await supabase.from('cotizacion_items')
      .delete()
      .eq('cotizacion_id', quoteId)
      .select('id');
    if (error) {
      console.error('Error eliminando las líneas de la cotización:', error);
      throw new Error(getErrorMessage(error));
    }

    invalidateTableCache('cotizacion_items');
    const deletedIds = new Set((deletedLines || []).map((item) => item.id));
    if (deletedIds.size < expectedCount) {
      await refreshData({ silent: true, force: true });
      throw new Error('No se eliminaron todas las líneas. Actualiza database.sql en Supabase y confirma que solo Administración tenga permiso para eliminar líneas.');
    }
    setData((current) => ({
      ...current,
      cotizacionItems: current.cotizacionItems.filter((item) => !deletedIds.has(item.id)),
    }));
    await logActivity({
      entidad: 'cotización',
      entidad_id: quote.numero,
      accion: 'líneas eliminadas permanentemente',
      descripcion: `Se eliminaron permanentemente ${deletedIds.size} línea(s) de la cotización ${quote.numero}. La cotización sigue en Papelera.`,
    });
    return deletedIds.size;
  };

  const markNotificationRead = async (id) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    if (error) {
      console.error('No se pudo marcar la notificación como leída:', error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache('notificaciones');
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
      .select(selectColumnsByTable.company_settings)
      .single();
    if (error) {
      console.error('Error guardando la configuración de la empresa:', error);
      throw new Error(getErrorMessage(error));
    }
    invalidateTableCache('company_settings');
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
    await refreshData({ force: true });
    return saved;
  };

  return (
    <DataContext.Provider value={{
      data, isLoaded, dataError: [dataError, realtimeError].filter(Boolean).join(' '), refreshData, saveCliente, saveVehiculo, saveTecnico,
      saveRepuesto, saveInforme, saveCotizacion, addOrden, updateOrdenEstado, updateOrden, convertQuoteToOrder,
      logActivity, archiveRecord, restoreRecord, permanentlyDeleteRecord, permanentlyDeleteQuoteLines, markNotificationRead, saveCompanySettings, saveUserAccess,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
