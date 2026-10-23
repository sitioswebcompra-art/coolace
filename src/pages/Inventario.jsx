import { useMemo, useState } from 'react';
import { PackagePlus, Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ArchiveButton, EmptyState, Field, InlineMessage, Modal, PageTitle, StatusBadge, formatMoney, inputClass } from '../components/ui';
import ExportActions from '../components/ExportActions';

const blank = { codigo: '', nombre: '', categoria: '', marca: '', descripcion: '', precio_compra: 0, precio_venta: 0, impuesto: 19, stock: 0, unidad: 'unidad', estado: 'Activo', observaciones: '' };

export default function Inventario() {
  const { user } = useAuth();
  const { data, saveRepuesto, archiveRecord, isLoaded, dataError } = useData();
  const isAdmin = user?.role === 'Administrador';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => data.repuestos.filter((item) => !item.archived_at).filter((item) =>
    [item.codigo, item.nombre, item.categoria, item.marca].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase()))
  ), [data.repuestos, query]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveRepuesto({
        ...form,
        codigo: form.codigo.trim() || null,
        nombre: form.nombre.trim(),
        precio_compra: Number(form.precio_compra) || 0,
        precio_venta: Number(form.precio_venta) || 0,
        impuesto: Number(form.impuesto) || 0,
        stock: Number(form.stock) || 0,
        updated_at: new Date().toISOString(),
      });
      setOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded && !dataError) return <p className="text-slate-500">Cargando inventario...</p>;
  return <div className="space-y-6">
    <PageTitle title="Repuestos y materiales" description="Catálogo y existencias para informes técnicos y cotizaciones."
      actions={<><ExportActions title="Repuestos e inventario" rows={filtered.map((item) => ({
        Código: item.codigo, Producto: item.nombre, Categoría: item.categoria, Marca: item.marca,
        Descripción: item.descripcion, Stock: item.stock, Unidad: item.unidad,
        'Precio de compra': item.precio_compra, 'Precio de venta': item.precio_venta,
        'Impuesto (%)': item.impuesto, Estado: item.estado, Observaciones: item.observaciones,
      }))} /><button className="btn-primary flex items-center gap-2" onClick={() => { setForm(blank); setError(''); setOpen(true); }}><Plus size={18} /> Agregar repuesto</button></>} />
    <InlineMessage>{actionError}</InlineMessage>
    <InlineMessage tone="success">{notice}</InlineMessage>
    {dataError && <InlineMessage>{dataError}</InlineMessage>}
    <section className="card space-y-4">
      <div className="relative max-w-xl"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, nombre, categoría o marca" />
      </div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
        <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500">
          <th className="pb-3 pr-3">Código / producto</th><th className="pb-3 pr-3">Categoría</th><th className="pb-3 pr-3">Stock</th><th className="pb-3 pr-3">Costo</th><th className="pb-3 pr-3">Precio venta</th><th className="pb-3 pr-3">Estado</th><th className="pb-3 text-right">Acciones</th>
        </tr></thead>
        <tbody className="divide-y">{filtered.map((item) => <tr key={item.id}>
          <td className="py-4 pr-3"><p className="font-semibold">{item.nombre}</p><p className="text-xs text-slate-500">{item.codigo || 'Sin código'} · {item.marca || 'Sin marca'}</p></td>
          <td className="py-4 pr-3">{item.categoria || '—'}</td>
          <td className={`py-4 pr-3 font-semibold ${Number(item.stock) <= 2 ? 'text-red-600' : ''}`}>{item.stock} {item.unidad}</td>
          <td className="py-4 pr-3">{formatMoney(item.precio_compra)}</td><td className="py-4 pr-3">{formatMoney(item.precio_venta)}</td>
          <td className="py-4 pr-3"><StatusBadge value={item.estado} /></td>
          <td className="py-4 text-right"><div className="flex justify-end gap-2">
            <button className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs" onClick={() => { setForm({ ...blank, ...item }); setError(''); setOpen(true); }}><Pencil size={14} />Editar</button>
            {isAdmin && <ArchiveButton label={`el repuesto ${item.nombre}`}
              onArchive={async () => { await archiveRecord('repuestos', item.id); setNotice('El repuesto se archivó. Puedes restaurarlo desde Papelera.'); }}
              onError={setActionError} />}
          </div></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title={query ? 'No se encontraron repuestos' : 'Catálogo vacío'} detail={query ? 'Prueba con otro término.' : 'Agrega productos para utilizarlos en las cotizaciones.'} />}
    </section>
    {open && <Modal title={form.id ? 'Editar producto' : 'Nuevo repuesto o material'} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
        <InlineMessage>{error}</InlineMessage>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><input required className={inputClass} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
          <Field label="Código"><input className={inputClass} value={form.codigo || ''} onChange={(event) => setForm({ ...form, codigo: event.target.value })} /></Field>
          <Field label="Categoría"><input className={inputClass} value={form.categoria || ''} onChange={(event) => setForm({ ...form, categoria: event.target.value })} /></Field>
          <Field label="Marca"><input className={inputClass} value={form.marca || ''} onChange={(event) => setForm({ ...form, marca: event.target.value })} /></Field>
          <Field label="Precio de compra"><input className={inputClass} type="number" min="0" step="1" value={form.precio_compra} onChange={(event) => setForm({ ...form, precio_compra: event.target.value })} /></Field>
          <Field label="Precio de venta"><input className={inputClass} type="number" min="0" step="1" value={form.precio_venta} onChange={(event) => setForm({ ...form, precio_venta: event.target.value })} /></Field>
          <Field label="Impuesto (%)"><input className={inputClass} type="number" min="0" max="100" step="0.1" value={form.impuesto} onChange={(event) => setForm({ ...form, impuesto: event.target.value })} /></Field>
          <Field label="Stock actual"><input className={inputClass} type="number" min="0" step="0.01" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></Field>
          <Field label="Unidad"><input className={inputClass} value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })} /></Field>
          <Field label="Estado"><select className={inputClass} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}><option>Activo</option><option>Inactivo</option></select></Field>
          <Field label="Descripción" className="sm:col-span-2"><textarea className={inputClass} rows={2} value={form.descripcion || ''} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button disabled={saving} className="btn-primary inline-flex items-center gap-2"><PackagePlus size={16} />{saving ? 'Guardando...' : 'Guardar producto'}</button></div>
      </form>
    </Modal>}
  </div>;
}
