import { useState, useMemo } from 'react';
import { Icon, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/utils';
import { computeOpenLoans } from '../lib/loans';

const TX_META = {
  retiro:  { label:'Retiro',   icon:'log-out',     tone:'bg-clay-100 text-clay-600' },
  ingreso: { label:'Ingreso',  icon:'log-in',      tone:'bg-sage-100 text-sage-600' },
  alta:    { label:'Alta',     icon:'plus-circle', tone:'bg-steel-100 text-steel-700' },
  baja:    { label:'Baja',     icon:'trash-2',     tone:'bg-steel-100 text-ink-mute' },
  ajuste:  { label:'Ajuste',   icon:'scale',       tone:'bg-amber-100 text-amber-700' },
  estado:  { label:'Estado',   icon:'tag',         tone:'bg-steel-100 text-steel-700' },
  auditoria:{ label:'Auditoría', icon:'clipboard-check', tone:'bg-amber-100 text-amber-700' },
};

export function HistoryView({ transactions }) {
  const [tab, setTab] = useState('loans');
  const [filter, setFilter] = useState('');

  const openLoans = useMemo(() => computeOpenLoans(transactions), [transactions]);

  // Exporta el historial completo a CSV (compatible con Excel)
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Fecha', 'Tipo', 'Herramienta', 'Cantidad', 'Persona', 'Nota'],
      ...transactions.map(tx => [new Date(tx.ts).toLocaleString(), (TX_META[tx.type] || TX_META.ajuste).label, tx.toolName, tx.qty, tx.person || '', tx.note || '']),
    ];
    const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'); // BOM para acentos en Excel
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `historial-taller-${new Date().toISOString().slice(0,10)}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(tx => tx.toolName.toLowerCase().includes(q) || (tx.person||'').toLowerCase().includes(q));
  }, [transactions, filter]);

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-100 text-steel-700"><Icon name="history" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Trazabilidad</h3>
            <p className="text-xs text-ink-mute">Quién tiene qué y todo el historial de movimientos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        {transactions.length > 0 && (
          <button onClick={exportCsv} title="Descargar historial en CSV (Excel)"
            className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-medium text-ink-soft shadow-soft transition hover:bg-steel-50">
            <Icon name="file-down" size={15}/> <span className="hidden sm:inline">CSV</span>
          </button>
        )}
        <div className="flex gap-1 rounded-xl border border-steel-200 bg-steel-50 p-1">
          <button onClick={() => setTab('loans')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab==='loans' ? 'bg-white text-ink shadow-soft' : 'text-ink-mute'}`}>
            Fuera ahora {openLoans.length > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">{openLoans.length}</span>}
          </button>
          <button onClick={() => setTab('log')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab==='log' ? 'bg-white text-ink shadow-soft' : 'text-ink-mute'}`}>Historial</button>
        </div>
        </div>
      </div>

      {tab === 'loans' ? (
        openLoans.length === 0
          ? <EmptyState icon="check-circle" title="Todo en su sitio" subtitle="Nadie tiene herramientas fuera registradas a su nombre."/>
          : <div className="space-y-2">
              {openLoans.map((l, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-steel-200 bg-white p-3 shadow-soft">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 font-display font-bold">{l.person.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{l.person}</p>
                    <p className="truncate text-xs text-ink-mute">{l.toolName} · {l.qty} {l.qty===1?'unidad':'unidades'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-mute">desde {fmtDate(l.since)}</span>
                </div>
              ))}
            </div>
      ) : (
        <>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por herramienta o persona..."
            className="mb-3 w-full rounded-xl border border-steel-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-soft outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200"/>
          {filtered.length === 0
            ? <EmptyState icon="history" title="Sin movimientos" subtitle="Los retiros, ingresos y ajustes aparecerán aquí."/>
            : <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
                {filtered.map(tx => {
                  const m = TX_META[tx.type] || TX_META.ajuste;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-steel-100 bg-white px-3 py-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.tone}`}><Icon name={m.icon} size={15}/></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          <span className="font-semibold">{m.label}</span>{tx.qty > 0 && ` ×${tx.qty}`} · {tx.toolName}
                          {tx.person && <span className="text-ink-soft"> — {tx.person}</span>}
                        </p>
                        {tx.note && <p className="truncate text-[11px] text-ink-mute">{tx.note}</p>}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{fmtDate(tx.ts)}</span>
                    </div>
                  );
                })}
              </div>
          }
        </>
      )}
    </div>
  );
}
