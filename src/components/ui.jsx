import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

export function PageTitle({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-brand-dark">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, size = 'max-w-2xl' }) {
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-content ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function InlineMessage({ children, tone = 'error' }) {
  if (!children) return null;
  const colors = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-800'
    : tone === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-800'
      : 'border-red-200 bg-red-50 text-red-800';
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${colors}`}>{children}</p>;
}

export function ArchiveButton({ label, onArchive, onError }) {
  const [archiving, setArchiving] = useState(false);
  const handleArchive = async () => {
    if (!window.confirm(`¿Archivar ${label}? Se conservarán sus datos y podrás restaurarlo desde Papelera.`)) return;
    setArchiving(true);
    try {
      await onArchive();
    } catch (error) {
      onError(error?.message || `No se pudo archivar ${label}.`);
    } finally {
      setArchiving(false);
    }
  };
  return <button type="button" onClick={handleArchive} disabled={archiving}
    className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">
    <Trash2 size={14} />{archiving ? 'Archivando...' : 'Archivar'}
  </button>;
}

export function StatusBadge({ value }) {
  const normalized = (value || '').toLowerCase();
  const style = normalized.includes('complet') || normalized.includes('aprobad') || normalized === 'activo'
    ? 'bg-green-100 text-green-800'
    : normalized.includes('cancel') || normalized.includes('rechaz') || normalized.includes('inactiv') || normalized.includes('urgente')
      ? 'bg-red-100 text-red-800'
      : normalized.includes('proceso')
        ? 'bg-orange-100 text-orange-800'
        : normalized.includes('asign') || normalized.includes('confirm') || normalized.includes('enviad')
          ? 'bg-blue-100 text-blue-800'
          : normalized.includes('esper') || normalized.includes('borrador') || normalized.includes('pend') || normalized.includes('reprogram') || normalized.includes('vencid')
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{value || 'Sin estado'}</span>;
}

export function EmptyState({ title = 'Sin registros', detail = 'Cuando haya información, aparecerá aquí.' }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
    <p className="font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{detail}</p>
  </div>;
}

export const inputClass = 'input-field';

export function formatDate(value) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
}
