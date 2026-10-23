import { useMemo, useState } from 'react';
import { FileText, Plus, Printer, Send, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { ArchiveButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, formatDate, formatMoney, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const blankLine = { repuesto_id: '', descripcion: '', cantidad: '1', precio_unitario: '0', impuesto: '19', tipo: 'Repuesto' };
const datePlusDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export default function Cotizaciones() {
  const { user } = useAuth();
  const { data, saveCotizacion, archiveRecord, refreshData, convertQuoteToOrder, isLoaded, dataError } = useData();
  const isClient = user?.role === 'Cliente';
  const isAdmin = user?.role === 'Administrador';
  const canConvertQuote = ['Administrador', 'Supervisor'].includes(user?.role);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [conversionQuote, setConversionQuote] = useState(null);
  const [conversionForm, setConversionForm] = useState({
    fecha: datePlusDays(0), hora_inicio: '', tecnico_id: '', direccion: '', zona: '', prioridad: 'Normal',
  });
  const [form, setForm] = useState({
    mano_obra: '0', descuento: '0', fecha_vencimiento: datePlusDays(15),
    condiciones_pago: '', tiempo_estimado: '', garantia: '', observaciones: '',
    descripcion: '', lines: [{ ...blankLine }],
  });

  const sorted = useMemo(() => data.cotizaciones.filter((quote) => !quote.archived_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [data.cotizaciones]);

  const openNew = (orderId = '') => {
    const order = data.ordenes.find((item) => item.id === orderId);
    const report = order && data.informes.find((item) => !item.archived_at && item.orden_id === order.id);
    const importedLines = [
      ...(report?.repuestos || []).map((item) => ({ ...item, tipo: 'Repuesto' })),
      ...(report?.materiales || []).map((item) => ({ ...item, tipo: 'Material' })),
    ].map((item) => {
      const rawName = String(item.nombre || '');
      const quantityMatch = rawName.match(/^(.*)\s+x\s*(\d+(?:[.,]\d+)?)$/i);
      const name = quantityMatch?.[1]?.trim() || rawName;
      const catalogItem = data.repuestos.find((part) => part.nombre.toLowerCase() === name.toLowerCase());
      return {
        ...blankLine,
        repuesto_id: catalogItem ? String(catalogItem.id) : '',
        descripcion: name,
        cantidad: String(quantityMatch?.[2]?.replace(',', '.') || item.cantidad || 1),
        precio_unitario: String(catalogItem?.precio_venta || 0),
        impuesto: String(catalogItem?.impuesto ?? data.companySettings?.impuesto ?? 19),
        tipo: item.tipo,
      };
    });
    setSelectedOrder(orderId);
    setForm({
      mano_obra: '0', descuento: '0', fecha_vencimiento: datePlusDays(15),
      condiciones_pago: data.companySettings?.condiciones_pago || '',
      tiempo_estimado: '', garantia: '', observaciones: '',
      descripcion: [order?.servicio, report?.diagnostico].filter(Boolean).join('\n'),
      lines: importedLines.length ? importedLines : [{ ...blankLine }],
    });
    setError('');
    setShowModal(true);
  };

  const updateLine = (index, patch) => {
    setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));
  };

  const subtotal = Number(form.mano_obra || 0) + form.lines.reduce((sum, item) => sum + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const net = Math.max(0, subtotal - Number(form.descuento || 0));
  const taxRate = Number(data.companySettings?.impuesto ?? 19);
  const rawTax = Number(form.mano_obra || 0) * taxRate / 100 + form.lines.reduce((sum, item) =>
    sum + Number(item.cantidad || 0) * Number(item.precio_unitario || 0) * Number(item.impuesto ?? taxRate) / 100, 0);
  const tax = subtotal > 0 ? rawTax * (net / subtotal) : 0;
  const total = net + tax;

  const submit = async (event) => {
    event.preventDefault();
    const order = data.ordenes.find((item) => item.id === selectedOrder);
    if (!order) {
      setError('Selecciona una orden de trabajo para asociar la cotización.');
      return;
    }
    setSaving(true);
    setError('');
    const number = `COT-${Date.now().toString(36).toUpperCase()}`;
    try {
      const quote = await saveCotizacion({
        numero: number,
        orden_id: order.id,
        informe_id: data.informes.find((report) => report.orden_id === order.id)?.id || null,
        clienteId: order.clienteId,
        vehiculoId: order.vehiculoId,
        estado: 'Borrador',
        fecha_emision: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: form.fecha_vencimiento || null,
        mano_obra: Number(form.mano_obra) || 0,
        descuento: Number(form.descuento) || 0,
        impuestos: tax,
        total_neto: net,
        total,
        condiciones_pago: form.condiciones_pago,
        tiempo_estimado: form.tiempo_estimado,
        garantia: form.garantia,
        observaciones: `${form.descripcion}\n${form.observaciones}`.trim(),
        updated_at: new Date().toISOString(),
      });
      const items = form.lines.filter((item) => item.descripcion.trim()).map((item) => ({
        cotizacion_id: quote.id,
        repuesto_id: item.repuesto_id ? Number(item.repuesto_id) : null,
        descripcion: item.descripcion.trim(),
        cantidad: Number(item.cantidad) || 1,
        precio_unitario: Number(item.precio_unitario) || 0,
        impuesto: Number(item.impuesto) || 0,
        tipo: item.tipo || 'Repuesto',
      }));
      if (items.length) {
        const { error: itemError } = await supabase.from('cotizacion_items').insert(items);
        if (itemError) {
          console.error('No se pudieron guardar los detalles de la cotización:', itemError);
          throw new Error(`La cotización se creó, pero no se guardaron sus líneas: ${itemError.message}`);
        }
      }
      await refreshData();
      setShowModal(false);
      setNotice(`Cotización ${quote.numero} creada correctamente.`);
      window.setTimeout(() => setNotice(''), 4000);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (quote, estado) => {
    try {
      const updated = await saveCotizacion({ ...quote, estado, updated_at: new Date().toISOString() });
      if (estado === 'Aprobada') {
        setNotice(`Cotización ${quote.numero} aprobada. La orden asociada ${updated.orden_id} queda lista para continuar.`);
      }
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  const openConversion = (quote) => {
    const sourceOrder = data.ordenes.find((order) => order.id === quote.orden_id);
    setConversionQuote(quote);
    setConversionForm({
      fecha: datePlusDays(0),
      hora_inicio: '',
      tecnico_id: '',
      direccion: sourceOrder?.direccion || '',
      zona: sourceOrder?.zona || '',
      prioridad: sourceOrder?.prioridad || 'Normal',
    });
    setError('');
  };

  const submitConversion = async (event) => {
    event.preventDefault();
    if (!conversionQuote) return;
    setSaving(true);
    setError('');
    try {
      const order = await convertQuoteToOrder(conversionQuote.id, conversionForm);
      setConversionQuote(null);
      setNotice(`Cotización ${conversionQuote.numero} convertida en la orden ${order.id}.`);
      window.setTimeout(() => setNotice(''), 5000);
    } catch (conversionError) {
      setError(conversionError.message);
    } finally {
      setSaving(false);
    }
  };

  const respondToQuote = async (quote, decision) => {
    const verb = decision === 'Aprobada' ? 'aprobar' : 'rechazar';
    if (!window.confirm(`¿Confirmas ${verb} la cotización ${quote.numero}?`)) return;
    setError('');
    try {
      const { error: responseError } = await supabase.rpc('respond_to_quote', {
        quote_id: quote.id,
        decision,
      });
      if (responseError) throw new Error(responseError.message);
      await refreshData();
      setNotice(`La cotización ${quote.numero} fue ${decision.toLowerCase()}.`);
      window.setTimeout(() => setNotice(''), 4000);
    } catch (responseError) {
      console.error('No se pudo responder a la cotización:', responseError);
      setError(responseError.message || 'No se pudo guardar la respuesta.');
    }
  };

  const printQuote = (quote) => {
    const client = data.clientes.find((item) => item.id === quote.clienteId);
    const vehicle = data.vehiculos.find((item) => item.id === quote.vehiculoId);
    const company = data.companySettings;
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
    const items = data.cotizacionItems.filter((item) => item.cotizacion_id === quote.id);
    const rows = [
      ...(Number(quote.mano_obra) ? [`<tr><td>Mano de obra</td><td>1</td><td>${escape(formatMoney(quote.mano_obra))}</td><td>${escape(formatMoney(quote.mano_obra))}</td></tr>`] : []),
      ...items.map((item) => `<tr><td>${escape(item.descripcion)}</td><td>${escape(item.cantidad)}</td><td>${escape(formatMoney(item.precio_unitario))}</td><td>${escape(formatMoney(Number(item.cantidad) * Number(item.precio_unitario)))}</td></tr>`),
    ].join('');
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Permite las ventanas emergentes para generar el documento PDF.');
      return;
    }
    popup.opener = null;
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(quote.numero)}</title>
      <style>
        *{box-sizing:border-box}
        @page{size:A4;margin:16mm}
        body{font:13px/1.5 Inter,"Segoe UI",Arial,sans-serif;color:#102a43;max-width:920px;margin:36px auto;padding:0 24px}
        header{display:flex;justify-content:space-between;gap:24px;background:linear-gradient(120deg,#102a43,#145c91);color:white;padding:25px 28px;border-radius:12px}
        header h1{font-size:28px;line-height:1.15;margin:0 0 8px}
        header p{font-size:11px;line-height:1.7;color:#d8e8f5}
        .company-name{color:#9edcff;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
        .quote-meta{text-align:right;min-width:180px}
        .quote-number{font-size:16px;font-weight:700}
        .section{margin-top:25px}
        h2{font-size:14px;margin:0 0 10px;color:#145c91}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .info-card{border:1px solid #dbe4ee;border-radius:8px;padding:13px 15px;break-inside:avoid}
        .info-card p{margin:3px 0;color:#475569}
        table{width:100%;border-collapse:separate;border-spacing:0;margin-top:10px}
        th,td{text-align:left;padding:10px 11px;border-bottom:1px solid #dbe4ee;vertical-align:top}
        th{background:#eaf2f9;color:#173b5e;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        tbody tr:nth-child(even){background:#f7f9fc}
        th:nth-child(n+2),td:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .totals{margin:16px 0 0 auto;width:min(100%,340px);border:1px solid #dbe4ee;border-radius:9px;padding:10px 15px}
        .totals div{display:flex;justify-content:space-between;gap:20px;padding:6px 0;font-variant-numeric:tabular-nums}
        .totals .grand-total{border-top:1px solid #dbe4ee;margin-top:4px;padding-top:12px;font-size:17px;color:#075985}
        footer{margin-top:26px;padding-top:12px;border-top:1px solid #dbe4ee;color:#62748a;font-size:10px}
        @media print{body{max-width:none;margin:0;padding:0}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}th,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}
        @media(max-width:600px){body{margin:16px auto;padding:0 12px}header{flex-direction:column}.quote-meta{text-align:left}.info-grid{grid-template-columns:1fr}}
      </style></head><body>
      <header><div><div class="company-name">${escape(company?.nombre || 'CoolAceGest')}</div><p>${escape(company?.rut || '')}<br>${escape(company?.direccion || '')}<br>${escape(company?.telefono || '')} ${escape(company?.email || '')}</p></div><div class="quote-meta"><h1>Cotización</h1><div class="quote-number">${escape(quote.numero)}</div><p>Emitida: ${escape(formatDate(quote.fecha_emision))}<br>Vence: ${escape(formatDate(quote.fecha_vencimiento))}</p></div></header>
      <section class="section info-grid"><div class="info-card"><h2>Cliente</h2><strong>${escape(client?.nombre || '')}</strong><p>${escape(client?.rut || '')}</p><p>${escape(client?.contacto || '')} · ${escape(client?.email || '')}</p></div>
      <div class="info-card"><h2>Vehículo y servicio</h2><strong>${escape(vehicle?.patente || '')} · ${escape(vehicle?.marca || '')} ${escape(vehicle?.modelo || '')}</strong><p>Orden: ${escape(quote.orden_id || '')}</p><p>${escape(quote.observaciones || '')}</p></div></section>
      <section class="section"><h2>Detalle de la cotización</h2><table><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario (CLP)</th><th>Total (CLP)</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Sin líneas de detalle</td></tr>'}</tbody></table>
      <div class="totals"><div><span>Neto</span><strong>${escape(formatMoney(quote.total_neto))}</strong></div><div><span>Impuestos</span><strong>${escape(formatMoney(quote.impuestos))}</strong></div><div class="grand-total"><span>Total</span><strong>${escape(formatMoney(quote.total))}</strong></div></div></section>
      <footer><strong>Condiciones de pago:</strong> ${escape(quote.condiciones_pago || 'Por acordar')} · <strong>Garantía:</strong> ${escape(quote.garantia || 'Según condiciones del servicio')} · ${escape(quote.tiempo_estimado || '')}<br>Montos expresados en pesos chilenos (CLP).</footer>
      <script>window.addEventListener('load',()=>window.print())</script></body></html>`);
    popup.document.close();
  };

  const shareWhatsApp = (quote) => {
    const client = data.clientes.find((item) => item.id === quote.clienteId);
    const message = `Cotización ${quote.numero} para ${client?.nombre || 'cliente'}: ${formatMoney(quote.total)}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando cotizaciones...</p>;
  return <div className="space-y-6">
    <PageTitle title="Cotizaciones" description="Prepara ofertas a partir de órdenes e informes y registra su aprobación."
    actions={<><ExportActions title="Cotizaciones" rows={sorted.map((quote) => ({
      Número: quote.numero, Cliente: data.clientes.find((item) => item.id === quote.clienteId)?.nombre || '',
      Patente: data.vehiculos.find((item) => item.id === quote.vehiculoId)?.patente || '',
      Orden: quote.orden_id, Estado: quote.estado, 'Fecha de emisión': quote.fecha_emision,
      Vencimiento: quote.fecha_vencimiento, 'Mano de obra': quote.mano_obra,
      Descuento: quote.descuento, Impuestos: quote.impuestos, 'Total neto': quote.total_neto,
      Total: quote.total, 'Condiciones de pago': quote.condiciones_pago,
      Garantía: quote.garantia, Observaciones: quote.observaciones,
    }))} />{!isClient && <button onClick={() => openNew()} disabled={!data.ordenes.some((order) => !order.archived_at)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nueva cotización</button>}</>} />
    {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
    <InlineMessage>{actionError}</InlineMessage>
    {error && !showModal && <InlineMessage>{error}</InlineMessage>}
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="space-y-3">
      {sorted.length ? sorted.map((quote) => {
        const client = data.clientes.find((item) => item.id === quote.clienteId);
        const vehicle = data.vehiculos.find((item) => item.id === quote.vehiculoId);
        const overdue = quote.fecha_vencimiento && quote.fecha_vencimiento < new Date().toISOString().slice(0, 10) && !['Aprobada', 'Rechazada', 'Convertida'].includes(quote.estado);
        const state = overdue ? 'Vencida' : quote.estado;
        return <article key={quote.id} className="card flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-brand-blue">{quote.numero}</span><StatusBadge value={state} /></div>
            <p className="font-semibold text-brand-dark">{client?.nombre || 'Cliente'} · {vehicle?.patente || 'Vehículo'}</p>
            <p className="text-sm text-slate-500">Orden {quote.orden_id || '—'} · Emitida {formatDate(quote.fecha_emision)} · Vence {formatDate(quote.fecha_vencimiento)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="mr-2 text-lg text-brand-dark">{formatMoney(quote.total)}</strong>
            <button className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm" onClick={() => printQuote(quote)} title="Imprimir o guardar como PDF"><Printer size={15} />PDF</button>
            <button className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm" onClick={() => shareWhatsApp(quote)}><Send size={15} />WhatsApp</button>
            {isClient && ['Enviada', 'Vista'].includes(state) && <button className="btn-secondary text-green-700" title="Aprobar" onClick={() => respondToQuote(quote, 'Aprobada')}><ThumbsUp size={17} /></button>}
            {isClient && ['Enviada', 'Vista'].includes(state) && <button className="btn-secondary text-red-700" title="Rechazar" onClick={() => respondToQuote(quote, 'Rechazada')}><ThumbsDown size={17} /></button>}
            {!isClient && state === 'Enviada' && <button className="btn-secondary text-green-700" title="Aprobar" onClick={() => updateStatus(quote, 'Aprobada')}><ThumbsUp size={17} /></button>}
            {!isClient && state === 'Enviada' && <button className="btn-secondary text-red-700" title="Rechazar" onClick={() => updateStatus(quote, 'Rechazada')}><ThumbsDown size={17} /></button>}
            {!isClient && state === 'Borrador' && <button className="btn-secondary" onClick={() => updateStatus(quote, 'Enviada')}>Marcar enviada</button>}
            {canConvertQuote && state === 'Aprobada' && <button className="btn-primary inline-flex items-center gap-1.5 py-2 text-sm" onClick={() => openConversion(quote)}><Wrench size={15} />Convertir</button>}
            {isAdmin && <ArchiveButton label={`la cotización ${quote.numero}`}
              onArchive={async () => { await archiveRecord('cotizaciones', quote.id); setNotice(`La cotización ${quote.numero} se archivó. Puedes restaurarla desde Papelera.`); }}
              onError={setActionError} />}
          </div>
        </article>;
      }) : <EmptyState title="Aún no hay cotizaciones" detail="Crea una cotización desde una orden de trabajo para asociar cliente, vehículo e informe." />}
    </section>

    {!data.ordenes.some((order) => !order.archived_at) && <InlineMessage tone="info">Primero crea una orden de trabajo en Agenda.</InlineMessage>}
    {!isClient && <section className="card">
      <h3 className="mb-3 font-bold text-brand-dark">Crear desde informe</h3>
      <div className="flex flex-wrap gap-2">{data.ordenes.filter((order) => !order.archived_at && data.informes.some((report) => !report.archived_at && report.orden_id === order.id)).map((order) =>
        <button key={order.id} onClick={() => openNew(order.id)} className="btn-secondary inline-flex items-center gap-2"><FileText size={15} />{order.id} · {order.servicio}</button>
      )}{!data.ordenes.some((order) => !order.archived_at && data.informes.some((report) => !report.archived_at && report.orden_id === order.id)) && <p className="text-sm text-slate-500">Las órdenes con informe técnico aparecerán aquí.</p>}</div>
    </section>}

    {showModal && <Modal title="Nueva cotización" onClose={() => setShowModal(false)} size="max-w-4xl">
      <form onSubmit={submit} className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
        <InlineMessage>{error}</InlineMessage>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orden de trabajo"><select required className={inputClass} value={selectedOrder} onChange={(event) => setSelectedOrder(event.target.value)}>
            <option value="">Selecciona una orden</option>
            {data.ordenes.filter((order) => !order.archived_at).map((order) => <option key={order.id} value={order.id}>{order.id} · {order.servicio} · {data.clientes.find((client) => client.id === order.clienteId)?.nombre}</option>)}
          </select></Field>
          <Field label="Vencimiento"><input required className={inputClass} type="date" min={new Date().toISOString().slice(0, 10)} value={form.fecha_vencimiento} onChange={(event) => setForm({ ...form, fecha_vencimiento: event.target.value })} /></Field>
          <Field label="Descripción del trabajo"><textarea className={inputClass} rows={3} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
          <Field label="Observaciones"><textarea className={inputClass} rows={3} value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></Field>
        </div>
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h4 className="font-bold">Repuestos y materiales</h4><button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { ...blankLine }] })} className="btn-secondary inline-flex items-center gap-1 text-sm"><Plus size={15} />Agregar línea</button></div>
          {form.lines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-[1.3fr_2fr_0.8fr_1fr_0.7fr_auto]">
            <Field label="Catálogo"><select className={inputClass} value={line.repuesto_id} onChange={(event) => {
              const item = data.repuestos.find((part) => part.id === Number(event.target.value));
              updateLine(index, item ? { repuesto_id: String(item.id), descripcion: item.nombre, precio_unitario: String(item.precio_venta), impuesto: String(item.impuesto) } : { repuesto_id: '' });
            }}><option value="">Manual</option>{data.repuestos.filter((part) => !part.archived_at).map((part) => <option key={part.id} value={part.id}>{part.nombre}</option>)}</select></Field>
            <Field label="Descripción"><input className={inputClass} value={line.descripcion} onChange={(event) => updateLine(index, { descripcion: event.target.value })} /></Field>
            <Field label="Cantidad"><input className={inputClass} type="number" min="0.01" step="0.01" value={line.cantidad} onChange={(event) => updateLine(index, { cantidad: event.target.value })} /></Field>
            <Field label="Precio unitario"><input className={inputClass} type="number" min="0" value={line.precio_unitario} onChange={(event) => updateLine(index, { precio_unitario: event.target.value })} /></Field>
            <Field label="Impuesto %"><input className={inputClass} type="number" min="0" max="100" value={line.impuesto} onChange={(event) => updateLine(index, { impuesto: event.target.value })} /></Field>
            <button type="button" className="self-end rounded p-2 text-red-600 hover:bg-red-50" aria-label="Quitar línea" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}>×</button>
          </div>)}
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mano de obra"><input className={inputClass} type="number" min="0" value={form.mano_obra} onChange={(event) => setForm({ ...form, mano_obra: event.target.value })} /></Field>
          <Field label="Descuento"><input className={inputClass} type="number" min="0" value={form.descuento} onChange={(event) => setForm({ ...form, descuento: event.target.value })} /></Field>
          <Field label="Condiciones de pago"><input className={inputClass} value={form.condiciones_pago} onChange={(event) => setForm({ ...form, condiciones_pago: event.target.value })} /></Field>
          <Field label="Tiempo estimado"><input className={inputClass} value={form.tiempo_estimado} onChange={(event) => setForm({ ...form, tiempo_estimado: event.target.value })} /></Field>
          <Field label="Garantía"><input className={inputClass} value={form.garantia} onChange={(event) => setForm({ ...form, garantia: event.target.value })} /></Field>
        </div>
        <div className="ml-auto max-w-sm space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
          <div className="flex justify-between"><span>Descuento</span><strong>-{formatMoney(form.descuento)}</strong></div>
          <div className="flex justify-between"><span>Neto</span><strong>{formatMoney(net)}</strong></div>
          <div className="flex justify-between"><span>Impuestos ({taxRate}%)</span><strong>{formatMoney(tax)}</strong></div>
          <div className="flex justify-between border-t pt-2 text-base"><span>Total</span><strong>{formatMoney(total)}</strong></div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button><button disabled={saving || !selectedOrder} className="btn-primary">{saving ? 'Guardando...' : 'Crear borrador'}</button></div>
      </form>
    </Modal>}

    {conversionQuote && <Modal title={`Convertir ${conversionQuote.numero} en orden`} onClose={() => setConversionQuote(null)}>
      <form onSubmit={submitConversion} className="space-y-4 p-5">
        <InlineMessage>{error}</InlineMessage>
        <p className="text-sm text-slate-600">Se creará una nueva orden asociada al cliente y vehículo de la cotización aprobada.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha programada"><input required min={datePlusDays(0)} className={inputClass} type="date" value={conversionForm.fecha} onChange={(event) => setConversionForm({ ...conversionForm, fecha: event.target.value })} /></Field>
          <Field label="Hora"><input className={inputClass} type="time" value={conversionForm.hora_inicio} onChange={(event) => setConversionForm({ ...conversionForm, hora_inicio: event.target.value })} /></Field>
          <Field label="Técnico asignado"><select className={inputClass} value={conversionForm.tecnico_id} onChange={(event) => setConversionForm({ ...conversionForm, tecnico_id: event.target.value })}><option value="">Sin asignar</option>{data.tecnicos.filter((technician) => !technician.archived_at && technician.estado === 'Activo').map((technician) => <option key={technician.id} value={technician.id}>{technician.nombre}</option>)}</select></Field>
          <Field label="Prioridad"><select className={inputClass} value={conversionForm.prioridad} onChange={(event) => setConversionForm({ ...conversionForm, prioridad: event.target.value })}><option>Baja</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></Field>
          <Field label="Dirección del servicio"><input className={inputClass} value={conversionForm.direccion} onChange={(event) => setConversionForm({ ...conversionForm, direccion: event.target.value })} /></Field>
          <Field label="Zona"><input className={inputClass} value={conversionForm.zona} onChange={(event) => setConversionForm({ ...conversionForm, zona: event.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={() => setConversionQuote(null)}>Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creando orden...' : 'Crear orden de trabajo'}</button>
        </div>
      </form>
    </Modal>}
  </div>;
}
