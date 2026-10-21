import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Field, InlineMessage, PageTitle, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const defaults = { nombre: 'CoolAceGest', rut: '', direccion: '', telefono: '', email: '', logo_url: '', impuesto: 19, condiciones_pago: '' };

export default function Configuracion() {
  const { data, saveCompanySettings, isLoaded, dataError } = useData();
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (data.companySettings) setForm({ ...defaults, ...data.companySettings });
  }, [data.companySettings]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await saveCompanySettings({ ...form, impuesto: Number(form.impuesto) });
      setNotice('La configuración de la empresa se guardó correctamente.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando configuración...</p>;
  return <div className="space-y-6">
    <PageTitle title="Configuración" description="Datos corporativos para documentos y cotizaciones."
      actions={<ExportActions title="Configuración de empresa" rows={[{
        'Razón social': form.nombre, RUT: form.rut, Dirección: form.direccion,
        Teléfono: form.telefono, Correo: form.email, 'URL del logo': form.logo_url,
        'Impuesto (%)': form.impuesto, 'Condiciones de pago': form.condiciones_pago,
      }]} />} />
    {error && <InlineMessage>{error}</InlineMessage>}
    {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="card max-w-3xl">
      <div className="mb-5 flex items-center gap-3"><Building2 className="text-brand-blue" /><div><h3 className="font-bold">Datos de la empresa</h3><p className="text-sm text-slate-500">Se mostrarán en los documentos generados por el sistema.</p></div></div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social"><input required className={inputClass} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
          <Field label="RUT / Identificador fiscal"><input className={inputClass} value={form.rut || ''} onChange={(event) => setForm({ ...form, rut: event.target.value })} /></Field>
          <Field label="Teléfono"><input type="tel" className={inputClass} value={form.telefono || ''} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></Field>
          <Field label="Correo"><input type="email" className={inputClass} value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Dirección"><input className={inputClass} value={form.direccion || ''} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></Field>
          <Field label="Impuesto (%)"><input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.impuesto} onChange={(event) => setForm({ ...form, impuesto: event.target.value })} /></Field>
          <Field label="URL del logo" className="sm:col-span-2"><input type="url" className={inputClass} placeholder="https://" value={form.logo_url || ''} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} /></Field>
          <Field label="Condiciones de pago" className="sm:col-span-2"><textarea className={inputClass} rows={3} value={form.condiciones_pago || ''} onChange={(event) => setForm({ ...form, condiciones_pago: event.target.value })} /></Field>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" disabled={busy}><Save size={16} />{busy ? 'Guardando...' : 'Guardar configuración'}</button>
      </form>
    </section>
  </div>;
}
