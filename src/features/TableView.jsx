import { useState, useMemo } from 'react';
import { Icon, ToolIconDisplay, EmptyState } from '../components/ui';
import { TOOL_STATUS, getDrawerLabel } from '../constants';
import { belowMin } from '../lib/utils';

// Vista de tabla tipo Excel: todas las herramientas en filas, ordenable por columna
const COLUMNS = [
  { key:'name',      label:'Herramienta' },
  { key:'category',  label:'Categoría' },
  { key:'serial',    label:'No. Serie' },
  { key:'location',  label:'Ubicación' },
  { key:'drawerLbl', label:'Sección' },
  { key:'total',     label:'Total',      num:true },
  { key:'current',   label:'Disp.',      num:true },
  { key:'out',       label:'Fuera',      num:true },
  { key:'minStock',  label:'Mínimo',     num:true },
  { key:'statusLbl', label:'Estado' },
];

const STATUS_TONE = {
  ok:'bg-sage-100 text-sage-600', mantenimiento:'bg-amber-100 text-amber-700',
  calibracion:'bg-steel-100 text-steel-700', perdida:'bg-clay-100 text-clay-600',
};

function TrashPanel({ deletedTools, onRestore, onPurge }) {
  if (deletedTools.length === 0) return null;
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-steel-300 bg-steel-50/40 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft"><Icon name="trash-2" size={16}/> Papelera ({deletedTools.length})</p>
      <div className="space-y-1.5">
        {deletedTools.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-steel-200 bg-white px-3 py-2">
            <ToolIconDisplay icon={t.icon} iconUrl={t.iconUrl} size={18} className="text-ink-mute"/>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink-soft line-through">{t.name}</p>
              <p className="text-[11px] text-ink-mute">eliminada {t.deletedAt ? new Date(t.deletedAt).toLocaleDateString('es-MX') : ''}</p>
            </div>
            <button onClick={() => onRestore(t)} className="flex items-center gap-1 rounded-lg bg-sage-100 px-2.5 py-1.5 text-xs font-semibold text-sage-600 transition hover:bg-sage-200">
              <Icon name="undo-2" size={13}/> Restaurar
            </button>
            <button onClick={() => onPurge(t)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-clay-600 transition hover:bg-clay-50" title="Borrar definitivamente">
              <Icon name="x" size={13}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableView({ tools, containers, onEdit, deletedTools = [], onRestore, onPurge }) {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState(1); // 1 asc, -1 desc
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => tools.map(t => {
    const c = containers.find(c => c.id === t.container);
    return {
      ...t,
      location: c?.name || '—',
      drawerLbl: c ? getDrawerLabel(c, t.drawer) : '—',
      out: t.total - t.current,
      statusLbl: TOOL_STATUS[t.status || 'ok']?.label || 'Disponible',
    };
  }), [tools, containers]);

  const sorted = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = q
      ? rows.filter(r => [r.name, r.category, r.serial, r.location, r.drawerLbl, r.statusLbl].some(v => String(v).toLowerCase().includes(q)))
      : rows;
    const col = COLUMNS.find(c => c.key === sortKey);
    return [...list].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const cmp = col?.num ? (va - vb) : String(va).localeCompare(String(vb), 'es');
      return cmp * sortDir;
    });
  }, [rows, sortKey, sortDir, filter]);

  const sortBy = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const totals = useMemo(() => ({
    total: sorted.reduce((a,r) => a + r.total, 0),
    current: sorted.reduce((a,r) => a + r.current, 0),
    out: sorted.reduce((a,r) => a + r.out, 0),
  }), [sorted]);

  // Exportar CSV (compatible con Excel: BOM UTF-8 y separador ;)
  const exportCsv = () => {
    const head = COLUMNS.map(c => c.label).join(';');
    const lines = sorted.map(r => COLUMNS.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['﻿' + [head, ...lines].join('\r\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href:url, download:`inventario-${new Date().toISOString().slice(0,10)}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-100 text-steel-700"><Icon name="table" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Vista de tabla</h3>
            <p className="text-xs text-ink-mute">{sorted.length} herramientas · clic en una columna para ordenar, doble clic en una fila para editar</p>
          </div>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50">
          <Icon name="file-spreadsheet" size={16}/> Exportar CSV
        </button>
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar en la tabla..."
        className="mb-3 w-full rounded-xl border border-steel-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-soft outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200 sm:max-w-xs"/>

      {sorted.length === 0 ? (
        <EmptyState icon="table" title="Sin datos" subtitle="No hay herramientas que coincidan con el filtro."/>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-steel-200">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-steel-50">
                <th className="w-10 border-b border-steel-200 px-2 py-2.5"></th>
                {COLUMNS.map(c => (
                  <th key={c.key} onClick={() => sortBy(c.key)}
                    className={`cursor-pointer select-none border-b border-steel-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-steel-700 transition hover:bg-steel-100 ${c.num ? 'text-right' : 'text-left'}`}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key && <Icon name={sortDir === 1 ? 'chevron-up' : 'chevron-down'} size={13}/>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} onDoubleClick={() => onEdit(tools.find(t => t.id === r.id))}
                  className={`cursor-default transition hover:bg-steel-50/70 ${i % 2 === 1 ? 'bg-steel-50/30' : 'bg-white'} ${belowMin(r) ? '!bg-clay-50/60' : ''}`}>
                  <td className="border-b border-steel-100 px-2 py-2 text-center">
                    <ToolIconDisplay icon={r.icon} iconUrl={r.iconUrl} size={18} className="text-steel-600"/>
                  </td>
                  <td className="border-b border-steel-100 px-3 py-2 font-medium text-ink">{r.name}</td>
                  <td className="border-b border-steel-100 px-3 py-2 text-ink-soft">{r.category}</td>
                  <td className="border-b border-steel-100 px-3 py-2 font-mono text-xs text-ink-mute">{r.serial || '—'}</td>
                  <td className="border-b border-steel-100 px-3 py-2 text-ink-soft">{r.location}</td>
                  <td className="border-b border-steel-100 px-3 py-2 text-ink-soft">{r.drawerLbl}</td>
                  <td className="border-b border-steel-100 px-3 py-2 text-right tabular-nums">{r.total}</td>
                  <td className={`border-b border-steel-100 px-3 py-2 text-right font-semibold tabular-nums ${r.current === 0 ? 'text-clay-600' : 'text-ink'}`}>{r.current}</td>
                  <td className={`border-b border-steel-100 px-3 py-2 text-right tabular-nums ${r.out > 0 ? 'font-semibold text-amber-700' : 'text-ink-mute'}`}>{r.out}</td>
                  <td className={`border-b border-steel-100 px-3 py-2 text-right tabular-nums ${belowMin(r) ? 'font-bold text-clay-600' : 'text-ink-mute'}`}>{r.minStock || '—'}</td>
                  <td className="border-b border-steel-100 px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status || 'ok']}`}>{r.statusLbl}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-steel-50 font-semibold text-ink">
                <td className="px-2 py-2.5"></td>
                <td className="px-3 py-2.5" colSpan={5}>Totales ({sorted.length} herramientas)</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.current}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.out}</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <TrashPanel deletedTools={deletedTools} onRestore={onRestore} onPurge={onPurge}/>
    </div>
  );
}
