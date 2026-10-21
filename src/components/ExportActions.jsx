import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadExcel, printPdf } from '../lib/export';
import { InlineMessage } from './ui';

export default function ExportActions({ title, rows, summary = [] }) {
  const [error, setError] = useState('');
  const disabled = !rows.length && !summary.length;

  const exportPdf = () => {
    setError('');
    try {
      printPdf(title, rows, summary);
    } catch (exportError) {
      console.error('No se pudo generar el PDF:', exportError);
      setError(exportError.message || 'No se pudo generar el PDF.');
    }
  };

  const exportExcel = async () => {
    setError('');
    try {
      await downloadExcel(title, rows, summary);
    } catch (exportError) {
      console.error('No se pudo generar el archivo Excel:', exportError);
      setError(exportError.message || 'No se pudo generar el archivo Excel.');
    }
  };

  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={exportPdf} disabled={disabled}
      className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50">
      <FileText size={16} /> PDF
    </button>
    <button type="button" onClick={exportExcel} disabled={disabled}
      className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50">
      <Download size={16} /> Excel
    </button>
    {error && <span className="basis-full"><InlineMessage>{error}</InlineMessage></span>}
  </div>;
}
