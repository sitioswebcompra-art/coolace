import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { EmptyState, InlineMessage, PageTitle, formatDate } from '../components/ui';

export default function Papelera() {
  const { data, restoreRecord, isLoaded, dataError } = useData();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoringId, setRestoringId] = useState('');
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
    setRestoringId(`${item.table}:${item.id}`);
    try {
      await restoreRecord(item.table, item.id);
      setNotice(`${item.label} restaurado. Ya está disponible en su sección.`);
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setRestoringId('');
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando papelera...</p>;

  return <div className="space-y-6">
    <PageTitle title="Papelera" description={`${archived.length} registro(s) archivado(s). Conservan sus relaciones y se pueden restaurar cuando quieras.`} />
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
              <td className="py-4 text-right"><button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs" disabled={restoringId === key} onClick={() => restore(item)}>
                <RotateCcw size={14} />{restoringId === key ? 'Restaurando...' : 'Restaurar'}
              </button></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyState title="La papelera está vacía" detail="Cuando archives un registro, podrás restaurarlo desde aquí." />}
    </section>
  </div>;
}
