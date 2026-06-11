import React, { useState, useMemo } from 'react';
import { Icon, ToolIconDisplay, EmptyState, fieldCls } from '../components/ui';
import { getDrawerLabel } from '../constants';
import { loadRecentPeople } from '../lib/storage';

// Conteo cíclico (cycle counting — auditorías parciales continuas en vez de
// inventario anual completo; práctica estándar en almacenes top)
const AUDIT_DUE_DAYS = 30; // recomendación: auditar cada mueble al menos cada 30 días

function daysSince(ts) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function CycleCountView({ containers, tools, transactions = [], onApplyCount, onRecordAudit, auditor: defaultAuditor = '' }) {
  const [containerId, setContainerId] = useState('');
  const [counts, setCounts] = useState({});   // toolId -> valor contado
  const [auditor, setAuditor] = useState(defaultAuditor);
  const [done, setDone] = useState(false);

  // Última auditoría por mueble (calendario de conteo cíclico)
  const lastAudit = useMemo(() => {
    const m = {};
    transactions.filter(tx => tx.type === 'auditoria').forEach(tx => {
      if (!m[tx.toolId] || new Date(tx.ts) > new Date(m[tx.toolId])) m[tx.toolId] = tx.ts;
    });
    return m;
  }, [transactions]);

  const container = containers.find(c => c.id === containerId);
  const containerTools = useMemo(() =>
    tools.filter(t => t.container === containerId).sort((a, b) => a.drawer - b.drawer || a.name.localeCompare(b.name)),
  [tools, containerId]);

  const start = (id) => { setContainerId(id); setCounts({}); setDone(false); };

  const discrepancies = useMemo(() =>
    containerTools.filter(t => counts[t.id] !== undefined && counts[t.id] !== '' && Number(counts[t.id]) !== t.current),
  [containerTools, counts]);

  const countedAll = containerTools.length > 0 && containerTools.every(t => counts[t.id] !== undefined && counts[t.id] !== '');

  const finish = () => {
    discrepancies.forEach(t => onApplyCount(t.id, Number(counts[t.id]), auditor.trim()));
    if (container && onRecordAudit) onRecordAudit(container, auditor.trim(), discrepancies.length);
    setDone(true);
  };

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Icon name="clipboard-check" size={22}/></span>
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">Conteo cíclico</h3>
          <p className="text-xs text-ink-mute">Audita un mueble a la vez: cuenta lo real y corrige el sistema</p>
        </div>
      </div>

      {!containerId ? (
        <>
          <p className="mb-3 text-sm text-ink-soft">Elige el mueble a auditar hoy (los marcados en rojo llevan más de {AUDIT_DUE_DAYS} días sin contar):</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...containers].sort((a, b) => {
              const da = lastAudit[a.id] ? daysSince(lastAudit[a.id]) : Infinity;
              const db = lastAudit[b.id] ? daysSince(lastAudit[b.id]) : Infinity;
              return db - da; // los más atrasados primero
            }).map(c => {
              const count = tools.filter(t => t.container === c.id).length;
              const last = lastAudit[c.id];
              const days = last ? daysSince(last) : null;
              const overdue = days === null || days > AUDIT_DUE_DAYS;
              return (
                <button key={c.id} onClick={() => start(c.id)} disabled={count === 0}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-soft transition hover:shadow-lift disabled:opacity-40 ${overdue && count > 0 ? 'border-clay-300' : 'border-steel-200'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${overdue && count > 0 ? 'bg-clay-100 text-clay-600' : 'bg-sage-100 text-sage-600'}`}>
                    <Icon name={overdue ? 'calendar-x' : 'calendar-check'} size={19}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-mute">{count} herramientas</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${overdue && count > 0 ? 'bg-clay-500 text-white' : 'bg-sage-100 text-sage-600'}`}>
                    {days === null ? 'Nunca auditado' : days === 0 ? 'Hoy' : `hace ${days} día${days===1?'':'s'}`}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : done ? (
        <div className="text-center py-8">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-sage-100 text-sage-600"><Icon name="check-circle" size={28}/></span>
          <h4 className="font-display text-lg font-semibold text-ink">Auditoría completada</h4>
          <p className="mt-1 text-sm text-ink-mute">{discrepancies.length === 0 ? 'Sin discrepancias: el sistema coincide con la realidad.' : `${discrepancies.length} ajuste(s) aplicados y registrados en el historial.`}</p>
          <button onClick={() => setContainerId('')} className="mt-4 rounded-xl bg-steel-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-steel-900">Auditar otro mueble</button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{container?.name} · {containerTools.length} items</p>
            <button onClick={() => setContainerId('')} className="text-sm font-medium text-steel-600 hover:text-steel-800">Cancelar</button>
          </div>
          <input className={`${fieldCls} mb-3`} value={auditor} onChange={e => setAuditor(e.target.value)} placeholder="¿Quién audita? (opcional)" list="recent-people-audit"/>
          <datalist id="recent-people-audit">{loadRecentPeople().map(p => <option key={p} value={p}/>)}</datalist>

          {containerTools.length === 0 ? <EmptyState icon="inbox" title="Mueble vacío" subtitle="No hay nada que contar aquí."/> : (
            <div className="space-y-1.5">
              {containerTools.map(t => {
                const val = counts[t.id];
                const diff = val !== undefined && val !== '' && Number(val) !== t.current;
                return (
                  <div key={t.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${diff ? 'border-amber-300 bg-amber-50/50' : 'border-steel-100 bg-white'}`}>
                    <ToolIconDisplay icon={t.icon} iconUrl={t.iconUrl} size={20} className="text-steel-600"/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{t.name}</p>
                      <p className="text-[11px] text-ink-mute">{container ? getDrawerLabel(container, t.drawer) : ''} · sistema: {t.current}/{t.total}</p>
                    </div>
                    <input type="number" min="0" max={t.total} value={val ?? ''} placeholder="¿?"
                      onChange={e => setCounts(prev => ({ ...prev, [t.id]: e.target.value }))}
                      className="w-20 rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-center text-sm font-bold tabular-nums outline-none focus:border-steel-400"/>
                    {diff && <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">{Number(val) > t.current ? '+' : ''}{Number(val) - t.current}</span>}
                  </div>
                );
              })}
              <button onClick={finish} disabled={!countedAll}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-steel-800 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900 disabled:opacity-40">
                <Icon name="clipboard-check" size={16}/>
                {countedAll
                  ? (discrepancies.length > 0 ? `Aplicar ${discrepancies.length} ajuste(s)` : 'Confirmar: todo coincide')
                  : `Faltan ${containerTools.filter(t => counts[t.id] === undefined || counts[t.id] === '').length} por contar`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
