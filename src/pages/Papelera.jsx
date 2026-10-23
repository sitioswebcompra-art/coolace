import { useState } from 'react';
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { EmptyState, Field, InlineMessage, Modal, PageTitle, formatDate, inputClass } from '../components/ui';

const relationshipDefinitions = {
  clientes: [
    { key: 'vehiculos', label: 'Vehículos', path: '/vehiculos', field: 'clienteId' },
    { key: 'ordenes', label: 'Órdenes de trabajo', path: '/agenda', field: 'clienteId' },
    { key: 'cotizaciones', label: 'Cotizaciones', path: '/cotizaciones', field: 'clienteId' },
    { key: 'profiles', label: 'Usuarios asociados', path: '/usuarios', field: 'cliente_id' },
  ],
  vehiculos: [
    { key: 'ordenes', label: 'Órdenes de trabajo', path: '/agenda', field: 'vehiculoId' },
    { key: 'cotizaciones', label: 'Cotizaciones', path: '/cotizaciones', field: 'vehiculoId' },
  ],
  ordenes: [
    { key: 'informes', label: 'Informes técnicos', path: '/informes', field: 'orden_id' },
    { key: 'cotizaciones', label: 'Cotizaciones', path: '/cotizaciones', field: 'orden_id' },
  ],
  informes_tecnicos: [
    { key: 'cotizaciones', label: 'Cotizaciones', path: '/cotizaciones', field: 'informe_id' },
  ],
  cotizaciones: [
    { key: 'cotizacionItems', label: 'Líneas de cotización', field: 'cotizacion_id', managedHere: true },
  ],
  tecnicos: [
    { key: 'ordenes', label: 'Órdenes de trabajo', path: '/agenda', field: 'tecnico_id' },
    { key: 'informes', label: 'Informes técnicos', path: '/informes', field: 'tecnico_id' },
  ],
};

export default function Papelera() {
  const { data, restoreRecord, permanentlyDeleteRecord, permanentlyDeleteQuoteLines, refreshData, isLoaded, dataError } = useData();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedForDeletion, setSelectedForDeletion] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLinesConfirmation, setDeleteLinesConfirmation] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const archiveTypes = [
    { table: 'clientes', key: 'clientes', label: 'Cliente', name: (record) => record.nombre, detail: (record) => record.rut },
    { table: 'vehiculos', key: 'vehiculos', label: 'Vehículo', name: (record) => record.patente, detail: (record) => `${record.marca || ''} ${record.modelo || ''}`.trim() },
    { table: 'ordenes', key: 'ordenes', label: 'Orden', name: (record) => record.id, detail: (record) => record.servicio },
    { table: 'informes_tecnicos', key: 'informes', label: 'Informe técnico', name: (record) => `Orden ${record.orden_id}`, detail: (record) => record.diagnostico || record.estado },
    { table: 'cotizaciones', key: 'cotizaciones', label: 'Cotización', name: (record) => record.numero, detail: (record) => record.estado },
    { table: 'tecnicos', key: 'tecnicos', label: 'Técnico', name: (record) => record.nombre, detail: (record) => record.especialidad },
    { table: 'repuestos', key: 'repuestos', label: 'Repuesto', name: (record) => record.nombre, detail: (record) => record.codigo },
  ];
  const archived = archiveTypes.flatMap((type) => (data[type.key] || [])
    .filter((record) => record.archived_at)
    .map((record) => ({ ...type, record, id: record.id })))
    .sort((a, b) => new Date(b.record.archived_at) - new Date(a.record.archived_at));
  const blockingRelations = selectedForDeletion
    ? (relationshipDefinitions[selectedForDeletion.table] || []).map((relation) => ({
      ...relation,
      count: (data[relation.key] || []).filter((record) =>
        String(record[relation.field]) === String(selectedForDeletion.id)
      ).length,
    })).filter((relation) => relation.count > 0)
    : [];

  const restore = async (item) => {
    setError('');
    setNotice('');
    const key = `restore:${item.table}:${item.id}`;
    setPendingAction(key);
    try {
      await restoreRecord(item.table, item.id);
      setNotice(`${item.label} restaurado. Ya está disponible en su sección.`);
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setPendingAction('');
    }
  };

  const permanentlyDelete = async () => {
    if (!selectedForDeletion || deleteConfirmation !== 'delete') return;
    setError('');
    setNotice('');
    const item = selectedForDeletion;
    const key = `delete:${item.table}:${item.id}`;
    setPendingAction(key);
    try {
      await permanentlyDeleteRecord(item.table, item.id);
      setSelectedForDeletion(null);
      setDeleteConfirmation('');
      setNotice(`${item.label} eliminado permanentemente.`);
    } catch (deleteError) {
      setError(deleteError.message);
      setDeleteConfirmation('');
    } finally {
      setPendingAction('');
    }
  };

  const permanentlyDeleteLines = async () => {
    if (!selectedForDeletion || selectedForDeletion.table !== 'cotizaciones' || deleteLinesConfirmation !== 'delete') return;
    setError('');
    setNotice('');
    const item = selectedForDeletion;
    const key = `lines:${item.id}`;
    setPendingAction(key);
    try {
      const count = await permanentlyDeleteQuoteLines(item.id);
      setDeleteLinesConfirmation('');
      setDeleteConfirmation('');
      setNotice(`${count} línea(s) eliminada(s). La cotización sigue en Papelera; confirma por separado su eliminación permanente.`);
    } catch (deleteError) {
      setError(deleteError.message);
      setDeleteLinesConfirmation('');
    } finally {
      setPendingAction('');
    }
  };

  const refreshTrash = async () => {
    setRefreshing(true);
    try {
      await refreshData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando papelera...</p>;

  return <div className="space-y-6">
    <PageTitle title="Papelera" description={`${archived.length} registro(s) archivado(s). Puedes restaurarlos o eliminarlos permanentemente si no tienen datos relacionados.`}
      actions={<button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={refreshing || Boolean(pendingAction)} onClick={refreshTrash}>
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Actualizando...' : 'Actualizar'}
      </button>} />
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <InlineMessage>{error}</InlineMessage>
    <InlineMessage tone="success">{notice}</InlineMessage>
    <section className="card">
      {archived.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-3 pr-4">Tipo</th><th className="pb-3 pr-4">Registro</th><th className="pb-3 pr-4">Archivado</th><th className="pb-3 text-right">Acción</th>
          </tr></thead>
          <tbody className="divide-y">{archived.map((item) => {
            const key = `${item.table}:${item.id}`;
            return <tr key={key}>
              <td className="py-4 pr-4">{item.label}</td>
              <td className="py-4 pr-4"><p className="font-semibold text-brand-dark">{item.name(item.record) || 'Sin nombre'}</p><p className="text-xs text-slate-500">{item.detail(item.record) || ''}</p></td>
              <td className="py-4 pr-4 text-slate-600">{formatDate(item.record.archived_at)}</td>
              <td className="py-4 text-right"><div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs" disabled={Boolean(pendingAction)} onClick={() => restore(item)}>
                  <RotateCcw size={14} />{pendingAction === `restore:${key}` ? 'Restaurando...' : 'Restaurar'}
                </button>
                <button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs text-red-700 hover:bg-red-50" disabled={Boolean(pendingAction)} onClick={() => {
                  setError('');
                  setNotice('');
                  setDeleteConfirmation('');
                  setDeleteLinesConfirmation('');
                  setSelectedForDeletion(item);
                }}>
                  <Trash2 size={14} />Eliminar para siempre
                </button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyState title="La papelera está vacía" detail="Cuando archives un registro, podrás restaurarlo desde aquí." />}
    </section>
    {selectedForDeletion && <Modal title="Eliminar registro para siempre" onClose={() => {
      if (pendingAction) return;
      setSelectedForDeletion(null);
      setDeleteConfirmation('');
      setDeleteLinesConfirmation('');
      setError('');
    }}>
      <div className="space-y-4 p-5">
        <InlineMessage>{error}</InlineMessage>
        <p className="text-sm text-slate-700">
          Vas a eliminar permanentemente <strong>{selectedForDeletion.label}: {selectedForDeletion.name(selectedForDeletion.record) || 'Sin nombre'}</strong>.
          Esta acción no se puede deshacer. No se eliminarán otros registros automáticamente.
        </p>
        {blockingRelations.length > 0
          ? <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">No se puede eliminar este registro todavía:</p>
            <ul className="list-inside list-disc space-y-1">
              {blockingRelations.map((relation) => <li key={relation.key}>
                {relation.count} {relation.label.toLowerCase()} vinculados por <code>{relation.field}</code>.{' '}
                {relation.managedHere
                  ? 'Puedes eliminarlos por separado abajo.'
                  : <Link className="font-semibold underline" to={relation.path}>Revisar {relation.label.toLowerCase()}</Link>}
              </li>)}
            </ul>
            <p>Para proteger los datos, primero resuelve estas relaciones. Si el registro vinculado ya está archivado, elimínalo primero desde Papelera; si sigue activo, archívalo desde su sección y luego elimínalo desde Papelera. El conteo usa los datos cargados; Supabase valida nuevamente al confirmar.</p>
            {selectedForDeletion.table === 'cotizaciones' && blockingRelations.some((relation) => relation.key === 'cotizacionItems') && <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p>La cotización tiene {blockingRelations.find((relation) => relation.key === 'cotizacionItems')?.count} línea(s). Puedes eliminarlas ahora como una acción independiente; la cotización seguirá archivada.</p>
              <Field label='Escribe "delete" para eliminar solo las líneas'>
                <input className={inputClass} value={deleteLinesConfirmation} onChange={(event) => setDeleteLinesConfirmation(event.target.value)} autoComplete="off" />
              </Field>
              <button type="button" className="btn-secondary text-red-700" disabled={Boolean(pendingAction) || deleteLinesConfirmation !== 'delete'} onClick={permanentlyDeleteLines}>
                {pendingAction === `lines:${selectedForDeletion.id}` ? 'Eliminando líneas...' : 'Eliminar líneas por separado'}
              </button>
            </div>}
          </div>
          : <InlineMessage tone="info">No se detectan relaciones bloqueantes en los datos cargados. Supabase hará una última comprobación antes de eliminar.</InlineMessage>}
        <Field label='Escribe "delete" para confirmar'>
          <input autoFocus className={inputClass} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
        </Field>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" disabled={Boolean(pendingAction)} onClick={() => {
            setSelectedForDeletion(null);
            setDeleteConfirmation('');
            setDeleteLinesConfirmation('');
            setError('');
          }}>Cancelar</button>
          <button type="button" className="btn-primary bg-red-700 hover:bg-red-800" disabled={Boolean(pendingAction) || blockingRelations.length > 0 || deleteConfirmation !== 'delete'} onClick={permanentlyDelete}>
            <Trash2 size={15} className="mr-1 inline" />{pendingAction === `delete:${selectedForDeletion.table}:${selectedForDeletion.id}` ? 'Eliminando...' : 'Eliminar para siempre'}
          </button>
        </div>
      </div>
    </Modal>}
  </div>;
}
