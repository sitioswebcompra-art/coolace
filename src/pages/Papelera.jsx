import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { EmptyState, Field, InlineMessage, Modal, PageTitle, formatDate, inputClass } from '../components/ui';

export default function Papelera() {
  const { data, restoreRecord, permanentlyDeleteRecord, isLoaded, dataError } = useData();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedForDeletion, setSelectedForDeletion] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [pendingAction, setPendingAction] = useState('');
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
    } finally {
      setPendingAction('');
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando papelera...</p>;

  return <div className="space-y-6">
    <PageTitle title="Papelera" description={`${archived.length} registro(s) archivado(s). Puedes restaurarlos o eliminarlos permanentemente si no tienen datos relacionados.`} />
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
                  setDeleteConfirmation('');
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
      setError('');
    }}>
      <div className="space-y-4 p-5">
        <InlineMessage>{error}</InlineMessage>
        <p className="text-sm text-slate-700">
          Vas a eliminar permanentemente <strong>{selectedForDeletion.label}: {selectedForDeletion.name(selectedForDeletion.record) || 'Sin nombre'}</strong>.
          Esta acción no se puede deshacer. Si tiene registros relacionados, la base de datos impedirá el borrado y te indicará cuál debes resolver primero.
        </p>
        <Field label='Escribe "delete" para confirmar'>
          <input autoFocus className={inputClass} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
        </Field>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" disabled={Boolean(pendingAction)} onClick={() => {
            setSelectedForDeletion(null);
            setDeleteConfirmation('');
            setError('');
          }}>Cancelar</button>
          <button type="button" className="btn-primary bg-red-700 hover:bg-red-800" disabled={pendingAction === `delete:${selectedForDeletion.table}:${selectedForDeletion.id}` || deleteConfirmation !== 'delete'} onClick={permanentlyDelete}>
            <Trash2 size={15} className="mr-1 inline" />{pendingAction === `delete:${selectedForDeletion.table}:${selectedForDeletion.id}` ? 'Eliminando...' : 'Eliminar para siempre'}
          </button>
        </div>
      </div>
    </Modal>}
  </div>;
}
