import { zipSync } from 'fflate';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const escapeXml = (value) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[character]));

const safeFilename = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'exportacion';

const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const isCurrencyColumn = (header, row = {}) => {
  const normalized = String(header).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('%')) return false;
  if (/precio|costo|mano de obra|descuento|impuestos|total|neto|ingresos|monto/.test(normalized)) return true;
  return normalized === 'valor' &&
    /ingreso|monto|total|neto|precio|costo|valor cotizado/.test(String(row.Indicador || '').toLowerCase());
};

const isNumeric = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

const columnName = (number) => {
  let result = '';
  for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
};

const worksheetXml = (rows) => {
  const headers = Object.keys(rows[0]);
  const allRows = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  const rowXml = allRows.map((values, rowIndex) => {
    const cells = values.map((value, columnIndex) => {
      const address = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      const header = headers[columnIndex];
      const row = rows[rowIndex - 1] || {};
      const style = rowIndex > 0 && isCurrencyColumn(header, row) && isNumeric(value) ? ' s="1"' : '';
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${address}"${style}><v>${value}</v></c>`;
      }
      if (typeof value === 'boolean') {
        return `<c r="${address}" t="b"><v>${value ? 1 : 0}</v></c>`;
      }
      if (rowIndex > 0 && isCurrencyColumn(header, row) && isNumeric(value)) {
        return `<c r="${address}"${style}><v>${Number(value)}</v></c>`;
      }
      return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const lastCell = `${columnName(headers.length)}${allRows.length}`;
  const widths = headers.map((header, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${Math.min(Math.max(String(header).length + 2, 16), 40)}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <dimension ref="A1:${lastCell}"/>
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
      <cols>${widths}</cols><sheetData>${rowXml}</sheetData>
      <autoFilter ref="A1:${lastCell}"/>
    </worksheet>`;
};

export async function downloadExcel(title, rows, summary = []) {
  const sheets = [
    ...(summary.length ? [{ name: 'Resumen', rows: summary }] : []),
    ...(rows.length ? [{ name: 'Datos', rows }] : []),
  ];
  if (!sheets.length) return;
  const worksheetFiles = sheets.map((sheet, index) => [
    `xl/worksheets/sheet${index + 1}.xml`,
    worksheetXml(sheet.rows),
  ]);
  const workbookSheets = sheets.map((sheet, index) =>
    `<sheet name="${sheet.name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const worksheetRelationships = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const contentTypes = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const files = Object.fromEntries([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentTypes}</Types>`],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRelationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0;[Red]-&quot;$&quot; #,##0"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ...worksheetFiles,
  ].map(([path, content]) => [path, new TextEncoder().encode(content)]));
  const buffer = zipSync(files, { level: 6 });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(title)}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printPdf(title, rows, summary = []) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Permite las ventanas emergentes para generar el PDF.');

  const columns = rows.length ? Object.keys(rows[0]) : [];
  const formatValue = (header, value, row) => {
    if (isCurrencyColumn(header, row) && isNumeric(value)) return currencyFormatter.format(Number(value));
    return value;
  };
  const renderTable = (items) => {
    if (!items.length) return '<p class="empty">Sin datos para exportar.</p>';
    const headers = Object.keys(items[0]);
    return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th class="${isCurrencyColumn(header) ? 'money' : ''}">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${items.map((item) => `<tr>${headers.map((header) => {
      const value = formatValue(header, item[header], item);
      const numeric = isCurrencyColumn(header, item) || isNumeric(value);
      return `<td class="${numeric ? 'numeric' : ''} ${isCurrencyColumn(header, item) ? 'money' : ''}">${escapeHtml(value)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const summaryHtml = summary.length
    ? `<section class="summary-section"><h2>Resumen ejecutivo</h2><div class="summary-grid">${summary.map((item) => {
      const entries = Object.entries(item);
      const label = item.Indicador || entries[0]?.[0] || 'Resumen';
      const value = item.Valor ?? item.Monto ?? entries[1]?.[1] ?? '';
      const formatted = formatValue('Valor', value, item);
      const isMoney = isCurrencyColumn('Valor', item);
      return `<article class="summary-card ${isMoney ? 'summary-money' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatted)}</strong></article>`;
    }).join('')}</div></section>`
    : '';
  const generatedAt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
    <style>
      :root{color-scheme:light;--navy:#102a43;--blue:#0878c9;--muted:#62748a;--line:#dbe4ee;--pale:#f3f7fb}
      *{box-sizing:border-box}
      @page{size:landscape;margin:13mm 12mm 16mm}
      body{font:11px/1.45 Inter,"Segoe UI",Arial,sans-serif;color:var(--navy);margin:0;background:#fff}
      .report{max-width:1440px;margin:0 auto}
      header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;border-radius:12px;background:linear-gradient(120deg,#102a43,#145c91);color:white;padding:22px 26px;margin-bottom:24px}
      .brand{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9edcff;margin-bottom:7px}
      h1{font-size:24px;line-height:1.2;margin:0 0 7px;color:#fff}
      .subtitle{color:#d8e8f5;margin:0}
      .report-meta{text-align:right;color:#d8e8f5;font-size:10px;white-space:nowrap}
      .record-count{display:inline-block;margin-top:8px;padding:5px 9px;border:1px solid #ffffff55;border-radius:999px;color:#fff;font-weight:600}
      section{margin:0 0 22px}
      h2{font-size:14px;margin:0 0 10px;color:var(--navy)}
      .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
      .summary-card{min-height:66px;border:1px solid var(--line);border-left:3px solid var(--blue);border-radius:8px;padding:11px 13px;background:#fff;break-inside:avoid}
      .summary-card span{display:block;font-size:9px;color:var(--muted);margin-bottom:5px}
      .summary-card strong{display:block;font-size:15px;color:var(--navy);font-variant-numeric:tabular-nums}
      .summary-money strong{color:#075985}
      .table-wrap{width:100%;overflow:visible}
      table{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto}
      th,td{padding:8px 9px;text-align:left;vertical-align:top;overflow-wrap:anywhere;border-bottom:1px solid var(--line)}
      th{background:#eaf2f9;color:#173b5e;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border-top:1px solid var(--line)}
      th:first-child{border-radius:6px 0 0 0}
      th:last-child{border-radius:0 6px 0 0}
      tbody tr:nth-child(even){background:#f7f9fc}
      tbody tr{break-inside:avoid}
      td.numeric,th.numeric,td.money,th.money{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      td.money{font-weight:600;color:#075985}
      .empty{padding:18px;border:1px dashed var(--line);border-radius:8px;color:var(--muted);text-align:center}
      footer{display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding-top:8px;margin-top:20px;color:var(--muted);font-size:9px}
      @media screen{body{padding:24px;background:#f2f5f9}.report{background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #102a4318}}
      @media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary-card,th,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact}.report{max-width:none}.table-wrap{overflow:visible}footer{position:fixed;bottom:-10mm;left:0;right:0}}
    </style></head><body><main class="report"><header><div><div class="brand">CoolAceGest · Reporte del sistema</div><h1>${escapeHtml(title)}</h1><p class="subtitle">Documento generado desde el módulo de gestión</p></div><div class="report-meta">${escapeHtml(generatedAt)}<br><span class="record-count">${rows.length} registro(s)</span></div></header>
    ${summaryHtml}<section><h2>Detalle de registros</h2>${columns.length ? renderTable(rows) : '<p class="empty">Sin datos para exportar.</p>'}</section>
    <footer><span>Documento generado por CoolAceGest</span><span>Montos expresados en pesos chilenos (CLP)</span></footer></main>
    <script>window.addEventListener('load',()=>window.print())</script></body></html>`;

  popup.document.open();
  popup.document.write(content);
  popup.document.close();
}
