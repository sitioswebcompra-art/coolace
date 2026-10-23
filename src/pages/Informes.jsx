import { useRef, useState } from 'react';
import { Camera, ClipboardCheck, FileText, PenLine, Plus, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { ArchiveButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, formatDate, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const checklistItems = [
  'Estado general del equipo', 'Compresor', 'Condensador', 'Evaporador', 'Correas',
  'Ventiladores', 'Conexiones eléctricas', 'Mangueras', 'Fugas visibles',
  'Estado del refrigerante', 'Limpieza del sistema',
];
const blankMeasurements = {
  presion_alta: '', presion_baja: '', temperatura_entrada: '', temperatura_salida: '',
  amperaje_compresor: '', voltaje: '', temperatura_ambiente: '', horas_uso: '', nivel_refrigerante: '',
};
const nowLocal = () => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
};

async function prepareImage(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1440 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('No se pudo preparar la fotografía.'));
  }, 'image/jpeg', 0.78));
}

function SignaturePad({ canvasRef, onChange }) {
  const drawing = useRef(false);
  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const start = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#102a43';
  };
  const move = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    onChange(true);
  };
  const stop = () => { drawing.current = false; };
  return <canvas ref={canvasRef} width={900} height={220} onPointerDown={start} onPointerMove={move}
    onPointerUp={stop} onPointerCancel={stop}
    className="h-36 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white" aria-label="Firma del cliente" />;
}

export default function Informes() {
  const { user } = useAuth();
  const { data, saveInforme, updateOrdenEstado, archiveRecord, isLoaded, dataError } = useData();
  const isAdmin = user?.role === 'Administrador';
  const [searchParams] = useSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState(searchParams.get('orden') || '');
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [signatureActive, setSignatureActive] = useState(false);
  const signatureRef = useRef(null);
  const [form, setForm] = useState({
    diagnostico: '', observaciones: '', recomendaciones: '', tipo_trabajo: '',
    llegada: nowLocal(), termino: '', checklist: {}, mediciones: blankMeasurements,
    fallasText: '', repuestosText: '', materialesText: '',
  });

  const selectedOrder = data.ordenes.find((order) => !order.archived_at && order.id === selectedOrderId);
  const latestByOrder = new Map();
  data.informes.filter((report) => !report.archived_at).forEach((report) => {
    if (!latestByOrder.has(report.orden_id)) latestByOrder.set(report.orden_id, report);
  });

  const openReport = (order) => {
    const existing = latestByOrder.get(order.id);
    setSelectedOrderId(order.id);
    setForm({
      diagnostico: existing?.diagnostico || '',
      observaciones: existing?.observaciones || '',
      recomendaciones: existing?.recomendaciones || '',
      ubicacion: existing?.ubicacion || order.direccion || '',
      tipo_trabajo: existing?.tipo_trabajo || order.servicio || '',
      llegada: existing?.llegada ? new Date(existing.llegada).toISOString().slice(0, 16) : nowLocal(),
      termino: existing?.termino ? new Date(existing.termino).toISOString().slice(0, 16) : '',
      checklist: existing?.checklist || {},
      mediciones: { ...blankMeasurements, ...(existing?.mediciones || {}) },
      fallasText: (existing?.fallas || []).join(', '),
      repuestosText: (existing?.repuestos || []).map((part) => `${part.nombre || ''}${part.cantidad ? ` x${part.cantidad}` : ''}`).join('\n'),
      materialesText: (existing?.materiales || []).map((material) => `${material.nombre || ''}${material.cantidad ? ` x${material.cantidad}` : ''}`).join('\n'),
    });
    setPhotoFiles([]);
    setSignatureActive(false);
    setError('');
    setShowEditor(true);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignatureActive(false);
  };

  const printReport = async () => {
    if (!selectedOrder) return;
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Permite las ventanas emergentes para imprimir el informe.');
      return;
    }
    popup.opener = null;
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
    const vehicle = data.vehiculos.find((item) => item.id === selectedOrder.vehiculoId);
    const client = data.clientes.find((item) => item.id === selectedOrder.clienteId);
    const existing = latestByOrder.get(selectedOrder.id);
    const photoPaths = existing?.archivos || [];
    const imagePaths = [...photoPaths, ...(existing?.firma_path ? [existing.firma_path] : [])];
    let signedImages = [];
    if (imagePaths.length) {
      try {
        const { data: urls, error: urlError } = await supabase.storage.from('refrig-archivos').createSignedUrls(imagePaths, 3600);
        if (urlError) throw urlError;
        signedImages = (urls || []).filter((item) => item.signedUrl);
      } catch (urlError) {
        console.error('No se pudieron preparar las imágenes del informe:', urlError);
        setError(`No se pudieron cargar las imágenes para imprimir: ${urlError.message}`);
        popup.close();
        return;
      }
    }
    const checked = checklistItems.map((item) => `<tr><td>${escape(item)}</td><td>${escape(form.checklist[item] || 'Sin revisar')}</td></tr>`).join('');
    const measures = Object.entries(form.mediciones).filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => `<tr><td>${escape(key.replaceAll('_', ' '))}</td><td>${escape(value)}</td></tr>`).join('');
    const photoHtml = signedImages.filter((item) => photoPaths.includes(item.path))
      .map((item) => `<img src="${escape(item.signedUrl)}" alt="Evidencia del servicio">`).join('');
    const signature = signatureActive && signatureRef.current
      ? signatureRef.current.toDataURL('image/png')
      : signedImages.find((item) => item.path === existing?.firma_path)?.signedUrl;
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${escape(selectedOrder.id)}</title>
      <style>body{font:14px Arial,sans-serif;color:#172b4d;max-width:900px;margin:36px auto;padding:0 24px}header{border-bottom:2px solid #0878c9;padding-bottom:12px}h1{font-size:22px}h2{font-size:16px;margin:26px 0 8px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}section{margin-top:18px}.images{display:flex;flex-wrap:wrap;gap:10px}.images img{max-width:280px;max-height:220px;object-fit:contain}.sign{max-width:280px;max-height:100px;display:block;border-bottom:1px solid #555}.muted{color:#667085}@media print{body{margin:0 auto}}</style></head><body>
      <header><h1>Informe técnico · ${escape(selectedOrder.id)}</h1><p>${escape(form.tipo_trabajo || selectedOrder.servicio)} · ${escape(selectedOrder.fecha)}</p></header>
      <section><h2>Cliente y vehículo</h2><p>${escape(client?.nombre)} · RUT ${escape(client?.rut)}<br>${escape(vehicle?.patente)} · ${escape(vehicle?.marca)} ${escape(vehicle?.modelo)} · Equipo ${escape(vehicle?.equipo_marca || '')} ${escape(vehicle?.equipo_modelo || '')}</p>
      <p>Técnico: ${escape(selectedOrder.tecnico || user?.name)} · Llegada: ${escape(form.llegada)} · Término: ${escape(form.termino || '')}<br>Ubicación: ${escape(form.ubicacion || selectedOrder.direccion || '')}</p></section>
      <section><h2>Checklist</h2><table>${checked}</table></section><section><h2>Mediciones</h2><table>${measures || '<tr><td>Sin mediciones registradas</td></tr>'}</table></section>
      <section><h2>Diagnóstico</h2><p>${escape(form.diagnostico)}</p><h2>Fallas</h2><p>${escape(form.fallasText)}</p>
      <h2>Repuestos y materiales</h2><p>${escape(form.repuestosText)}<br>${escape(form.materialesText)}</p><h2>Observaciones</h2><p>${escape(form.observaciones)}</p><h2>Recomendaciones</h2><p>${escape(form.recomendaciones)}</p></section>
      <section><h2>Fotografías</h2><div class="images">${photoHtml || '<p class="muted">Guarda el informe para adjuntar las fotografías seleccionadas.</p>'}</div></section>
      <section><h2>Firma del cliente</h2>${signature ? `<img class="sign" src="${escape(signature)}" alt="Firma del cliente">` : '<p class="muted">Firma no registrada</p>'}</section>
      <script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const uploadFile = async (blob, path) => {
    const { data: uploaded, error: uploadError } = await supabase.storage.from('refrig-archivos').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (uploadError) throw new Error(`No se pudo guardar un archivo: ${uploadError.message}`);
    return uploaded.path;
  };

  const submit = async (event, complete = false) => {
    event?.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    setError('');
    try {
      const clientId = selectedOrder.clienteId;
      const prefix = `${clientId}/${selectedOrder.id}/${Date.now()}`;
      const uploadedPhotos = [];
      for (const [index, file] of photoFiles.entries()) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} supera el límite de 20 MB.`);
        const blob = await prepareImage(file);
        uploadedPhotos.push(await uploadFile(blob, `${prefix}-foto-${index + 1}.jpg`));
      }

      let signaturePath = latestByOrder.get(selectedOrder.id)?.firma_path || null;
      if (signatureActive && signatureRef.current) {
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = signatureRef.current.width;
        outputCanvas.height = signatureRef.current.height;
        const outputContext = outputCanvas.getContext('2d');
        outputContext.fillStyle = '#ffffff';
        outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
        outputContext.drawImage(signatureRef.current, 0, 0);
        const signatureBlob = await new Promise((resolve, reject) => outputCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('No se pudo procesar la firma.'));
        }, 'image/jpeg', 0.85));
        signaturePath = await uploadFile(signatureBlob, `${prefix}-firma.jpg`);
      }

      const previousFiles = latestByOrder.get(selectedOrder.id)?.archivos || [];
      const parseLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const match = line.match(/^(.*)\s+x\s*(\d+(?:[.,]\d+)?)$/i);
        return match
          ? { nombre: match[1].trim(), cantidad: Number(match[2].replace(',', '.')) }
          : { nombre: line, cantidad: 1 };
      });
      const saved = await saveInforme({
        ...(latestByOrder.get(selectedOrder.id) || {}),
        orden_id: selectedOrder.id,
        tecnico_id: selectedOrder.tecnico_id || null,
        estado: complete ? 'Completado' : 'Borrador',
        llegada: form.llegada ? new Date(form.llegada).toISOString() : null,
        termino: form.termino ? new Date(form.termino).toISOString() : (complete ? new Date().toISOString() : null),
        tipo_trabajo: form.tipo_trabajo,
        ubicacion: form.ubicacion || selectedOrder.direccion || null,
        checklist: form.checklist,
        mediciones: form.mediciones,
        diagnostico: form.diagnostico,
        fallas: form.fallasText.split(',').map((item) => item.trim()).filter(Boolean),
        repuestos: parseLines(form.repuestosText),
        materiales: parseLines(form.materialesText),
        observaciones: form.observaciones,
        recomendaciones: form.recomendaciones,
        archivos: [...previousFiles, ...uploadedPhotos],
        firma_path: signaturePath,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (complete) await updateOrdenEstado(selectedOrder.id, 'Completado');
      setNotice(`Informe ${saved.estado === 'Completado' ? 'completado' : 'guardado como borrador'} para ${selectedOrder.id}.`);
      setShowEditor(false);
      window.setTimeout(() => setNotice(''), 4000);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando informes técnicos...</p>;
  return <div className="space-y-6">
    <PageTitle title="Informes técnicos" description="Registra diagnósticos, mediciones, checklist, evidencias y firma desde terreno."
      actions={<ExportActions title="Informes técnicos" rows={data.informes.filter((report) => !report.archived_at).map((report) => {
        const order = data.ordenes.find((item) => item.id === report.orden_id);
        const vehicle = data.vehiculos.find((item) => item.id === order?.vehiculoId);
        const client = data.clientes.find((item) => item.id === order?.clienteId);
        return {
          Orden: report.orden_id, Cliente: client?.nombre || '', Patente: vehicle?.patente || '',
          Servicio: order?.servicio || '', Técnico: order?.tecnico || '', Estado: report.estado,
          Llegada: report.llegada, Término: report.termino, Diagnóstico: report.diagnostico,
          Fallas: (report.fallas || []).join(', '), Repuestos: JSON.stringify(report.repuestos || []),
          Materiales: JSON.stringify(report.materiales || []), Observaciones: report.observaciones,
          Recomendaciones: report.recomendaciones, 'Fecha de creación': report.created_at,
        };
      })} />} />
    <InlineMessage tone="success">{notice}</InlineMessage>
    <InlineMessage>{actionError}</InlineMessage>
    {error && !showEditor && <InlineMessage>{error}</InlineMessage>}
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="space-y-3">
      {data.ordenes.filter((order) => !order.archived_at).length ? data.ordenes.filter((order) => !order.archived_at).map((order) => {
        const client = data.clientes.find((item) => item.id === order.clienteId);
        const vehicle = data.vehiculos.find((item) => item.id === order.vehiculoId);
        const report = latestByOrder.get(order.id);
        const orderReports = data.informes.filter((item) => !item.archived_at && item.orden_id === order.id);
        return <article key={order.id} className="card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-brand-blue">{order.id}</span><StatusBadge value={order.estado} /><StatusBadge value={report?.estado || 'Sin informe'} /></div>
            <p className="mt-2 font-semibold text-brand-dark">{order.servicio} · {vehicle?.patente || 'Vehículo'}</p>
            <p className="text-sm text-slate-500">{client?.nombre || 'Cliente'} · {formatDate(order.fecha)} · {order.tecnico || 'Sin técnico asignado'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2">
            <button onClick={() => openReport(order)} className="btn-primary inline-flex items-center justify-center gap-2"><FileText size={17} />{report ? 'Abrir informe' : 'Completar informe'}</button>
            {isAdmin && orderReports.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Informe {formatDate(item.created_at)} · {item.estado}</span>
              <ArchiveButton label={`el informe técnico de la orden ${order.id}`}
                onArchive={async () => { await archiveRecord('informes_tecnicos', item.id); setNotice('El informe técnico se archivó. Puedes restaurarlo desde Papelera.'); }}
                onError={setActionError} />
            </div>)}
          </div>
        </article>;
      }) : <EmptyState title="No hay órdenes para informar" detail="Crea una orden de trabajo desde Agenda y aparecerá aquí." />}
    </section>

    {showEditor && selectedOrder && <Modal title={`Informe técnico · ${selectedOrder.id}`} onClose={() => setShowEditor(false)} size="max-w-4xl">
      <form onSubmit={(event) => submit(event, false)} className="max-h-[78vh] space-y-6 overflow-y-auto p-5">
        <InlineMessage>{error}</InlineMessage>
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-semibold">{selectedOrder.servicio} · {data.vehiculos.find((item) => item.id === selectedOrder.vehiculoId)?.patente}</p>
          <p className="text-slate-500">{data.clientes.find((item) => item.id === selectedOrder.clienteId)?.nombre} · Técnico: {selectedOrder.tecnico || user?.name}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de trabajo"><input className={inputClass} value={form.tipo_trabajo} onChange={(event) => setForm({ ...form, tipo_trabajo: event.target.value })} /></Field>
          <Field label="Ubicación"><input className={inputClass} value={form.ubicacion || selectedOrder.direccion || ''} onChange={(event) => setForm({ ...form, ubicacion: event.target.value })} /></Field>
          <Field label="Llegada"><input className={inputClass} type="datetime-local" value={form.llegada} onChange={(event) => setForm({ ...form, llegada: event.target.value })} /></Field>
          <Field label="Término"><input className={inputClass} type="datetime-local" value={form.termino} onChange={(event) => setForm({ ...form, termino: event.target.value })} /></Field>
        </div>

        <section><h4 className="mb-3 font-bold text-brand-dark">Checklist de inspección</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklistItems.map((item) => <label key={item} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{item}</span><select className="input-field w-auto min-w-28" value={form.checklist[item] || ''} onChange={(event) => setForm({ ...form, checklist: { ...form.checklist, [item]: event.target.value } })}>
                <option value="">Sin revisar</option><option>Bueno</option><option>Requiere atención</option><option>No aplica</option>
              </select>
            </label>)}
          </div>
        </section>

        <section><h4 className="mb-3 font-bold text-brand-dark">Mediciones técnicas</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['presion_alta', 'Presión de alta', 'bar'], ['presion_baja', 'Presión de baja', 'bar'],
              ['temperatura_entrada', 'Temperatura de entrada', '°C'], ['temperatura_salida', 'Temperatura de salida', '°C'],
              ['amperaje_compresor', 'Amperaje compresor', 'A'], ['voltaje', 'Voltaje', 'V'],
              ['temperatura_ambiente', 'Temperatura ambiente', '°C'], ['horas_uso', 'Horas de uso', 'h'],
              ['nivel_refrigerante', 'Nivel refrigerante', ''],
            ].map(([key, label, unit]) => <Field key={key} label={`${label}${unit ? ` (${unit})` : ''}`}>
              <input className={inputClass} type="number" step="any" value={form.mediciones[key] || ''} onChange={(event) => setForm({ ...form, mediciones: { ...form.mediciones, [key]: event.target.value } })} />
            </Field>)}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Diagnóstico"><textarea className={inputClass} rows={3} value={form.diagnostico} onChange={(event) => setForm({ ...form, diagnostico: event.target.value })} /></Field>
          <Field label="Fallas detectadas (separadas por coma)"><textarea className={inputClass} rows={3} value={form.fallasText} onChange={(event) => setForm({ ...form, fallasText: event.target.value })} /></Field>
          <Field label="Repuestos requeridos (uno por línea)"><textarea className={inputClass} rows={3} value={form.repuestosText} onChange={(event) => setForm({ ...form, repuestosText: event.target.value })} /></Field>
          <Field label="Materiales utilizados (uno por línea)"><textarea className={inputClass} rows={3} value={form.materialesText} onChange={(event) => setForm({ ...form, materialesText: event.target.value })} /></Field>
          <Field label="Observaciones"><textarea className={inputClass} rows={3} value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></Field>
          <Field label="Recomendaciones"><textarea className={inputClass} rows={3} value={form.recomendaciones} onChange={(event) => setForm({ ...form, recomendaciones: event.target.value })} /></Field>
        </div>

        <Field label="Fotografías del trabajo">
          <span className="flex items-center gap-2 text-xs text-slate-500"><Camera size={15} /> Se optimizan antes de subir y quedan en almacenamiento privado.</span>
          <input className={inputClass} type="file" accept="image/*" capture="environment" multiple onChange={(event) => setPhotoFiles(Array.from(event.target.files || []))} />
          {photoFiles.length > 0 && <p className="text-xs text-slate-500">{photoFiles.length} fotografía(s) seleccionada(s)</p>}
        </Field>

        <section className="space-y-2">
          <div className="flex items-center justify-between"><h4 className="font-bold text-brand-dark">Firma del cliente</h4><button type="button" onClick={clearSignature} className="btn-secondary inline-flex items-center gap-1 py-1.5 text-xs"><RotateCcw size={14} /> Limpiar</button></div>
          <SignaturePad canvasRef={signatureRef} onChange={setSignatureActive} />
          <p className="text-xs text-slate-500"><PenLine size={13} className="mr-1 inline" />Firma con el dedo o el mouse.</p>
        </section>

        <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row">
          <button type="button" onClick={printReport} className="btn-secondary inline-flex items-center justify-center gap-2"><Printer size={16} /> Imprimir / PDF</button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => submit(null, false)} disabled={saving} className="btn-secondary inline-flex items-center justify-center gap-2"><Save size={16} />Guardar borrador</button>
            <button type="button" onClick={() => {
              if (window.confirm('Al completar el informe, la orden se marcará como completada. ¿Continuar?')) submit(null, true);
            }} disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2"><ClipboardCheck size={16} />{saving ? 'Guardando...' : 'Completar informe'}</button>
          </div>
        </div>
      </form>
    </Modal>}
  </div>;
}
