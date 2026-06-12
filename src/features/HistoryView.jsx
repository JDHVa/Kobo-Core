import { useState, useMemo } from 'react';
import { Icon, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/utils';
import { computeOpenLoans } from '../lib/loans';
import { getDrawerLabel } from '../constants';

const TX_META = {
  retiro:  { label:'Retiro',   icon:'log-out',     tone:'bg-clay-100 text-clay-600' },
  ingreso: { label:'Ingreso',  icon:'log-in',      tone:'bg-sage-100 text-sage-600' },
  alta:    { label:'Alta',     icon:'plus-circle', tone:'bg-steel-100 text-steel-700' },
  baja:    { label:'Baja',     icon:'trash-2',     tone:'bg-steel-100 text-ink-mute' },
  ajuste:  { label:'Ajuste',   icon:'scale',       tone:'bg-amber-100 text-amber-700' },
  estado:  { label:'Estado',   icon:'tag',         tone:'bg-steel-100 text-steel-700' },
  auditoria:{ label:'Auditoría', icon:'clipboard-check', tone:'bg-amber-100 text-amber-700' },
};

export function HistoryView({ transactions, tools = [], containers = [] }) {
  const [tab, setTab] = useState('loans');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null); // persona desplegada

  const openLoans = useMemo(() => computeOpenLoans(transactions), [transactions]);

  // Préstamos agrupados por persona: clic para ver qué tiene y de dónde salió
  const byPerson = useMemo(() => {
    const map = new Map();
    for (const l of openLoans) {
      const key = l.person.toLowerCase();
      const g = map.get(key) || { person: l.person, items: [], total: 0, since: l.since };
      g.items.push(l);
      g.total += l.qty;
      if (new Date(l.since) < new Date(g.since)) g.since = l.since;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => new Date(a.since) - new Date(b.since));
  }, [openLoans]);

  // De dónde se tomó la herramienta (mueble + sección)
  const locationOf = (toolId) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return 'Ubicación no disponible';
    const c = containers.find(c => c.id === tool.container);
    if (!c) return 'Sin contenedor';
    return `${c.name} · ${getDrawerLabel(c, tool.drawer)}`;
  };

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
        byPerson.length === 0
          ? <EmptyState icon="check-circle" title="Todo en su sitio" subtitle="Nadie tiene herramientas fuera registradas a su nombre."/>
          : <div className="space-y-2">
              {byPerson.map(g => {
                const key = g.person.toLowerCase();
                const isOpen = expanded === key;
                return (
                  <div key={key} className="overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-soft">
                    <button onClick={() => setExpanded(isOpen ? null : key)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-steel-50/60">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 font-display font-bold">{g.person.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{g.person}</p>
                        <p className="truncate text-xs text-ink-mute">
                          {g.items.length} {g.items.length===1?'herramienta':'herramientas'} · {g.total} {g.total===1?'unidad':'unidades'} fuera
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink-mute">desde {fmtDate(g.since)}</span>
                      <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} className="shrink-0 text-ink-mute"/>
                    </button>
                    {isOpen && (
                      <div className="space-y-1.5 border-t border-steel-100 bg-steel-50/40 p-3">
                        {g.items.map((l, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-steel-100 bg-white px-3 py-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-clay-100 text-clay-600"><Icon name="wrench" size={14}/></span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">{l.toolName} <span className="font-normal text-ink-soft">× {l.qty}</span></p>
                              <p className="truncate text-xs text-ink-mute"><Icon name="map-pin" size={11} className="mr-0.5"/> {locationOf(l.toolId)}</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-ink-mute">desde {fmtDate(l.since)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
