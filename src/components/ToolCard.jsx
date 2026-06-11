import React, { useState } from 'react';
import { Icon, ToolIconDisplay, StatusBadge, StockBar } from './ui';
import { TOOL_STATUS } from '../constants';
import { belowMin } from '../lib/utils';

const STATUS_TONE = {
  ok:'bg-sage-100 text-sage-600', mantenimiento:'bg-amber-100 text-amber-700',
  calibracion:'bg-steel-100 text-steel-700', perdida:'bg-clay-100 text-clay-600',
};

export function ToolCard({ tool, loans = [], onCheckout, onEdit, onDelete, onSetStatus }) {
  const [statusMenu, setStatusMenu] = useState(false);
  const st = TOOL_STATUS[tool.status || 'ok'];
  const blocked = tool.status && tool.status !== 'ok';

  return (
    <div className={`group relative flex flex-col rounded-2xl border bg-white p-4 shadow-soft transition hover:shadow-lift animate-fade-up ${belowMin(tool) ? 'border-clay-300' : 'border-steel-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          {(tool.icon || tool.iconUrl) && (
            <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-steel-50 text-steel-600">
              <ToolIconDisplay icon={tool.icon} iconUrl={tool.iconUrl} size={24}/>
            </span>
          )}
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-md bg-steel-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-steel-600">{tool.category}</span>
            <h4 className="mt-1.5 truncate font-display text-lg font-semibold leading-tight text-ink">{tool.name}</h4>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-mute"><Icon name="hash" size={12}/> {tool.serial || 'Sin serie'}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
          <button onClick={() => onEdit(tool)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-steel-50 hover:text-steel-700"><Icon name="pencil" size={15}/></button>
          <button onClick={() => onDelete(tool)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-clay-50 hover:text-clay-600"><Icon name="trash-2" size={15}/></button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge tool={tool}/>
        <div className="relative">
          <button onClick={() => setStatusMenu(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80 ${STATUS_TONE[tool.status || 'ok']}`}>
            <Icon name={st.icon} size={13}/> {st.label} <Icon name="chevron-down" size={11}/>
          </button>
          {statusMenu && (
            <div className="absolute left-0 top-8 z-20 w-48 rounded-xl border border-steel-200 bg-white p-1 shadow-lift">
              {Object.entries(TOOL_STATUS).map(([key, s]) => (
                <button key={key} onClick={() => { onSetStatus(tool.id, key); setStatusMenu(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition hover:bg-steel-50 ${key === (tool.status||'ok') ? 'text-ink' : 'text-ink-mute'}`}>
                  <Icon name={s.icon} size={14}/> {s.label}
                  {key === (tool.status||'ok') && <Icon name="check" size={13} className="ml-auto text-sage-500"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3"><StockBar tool={tool}/></div>

      {loans.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><Icon name="users" size={12}/> Fuera con:</p>
          {loans.map((l, i) => (
            <p key={i} className="text-xs text-ink-soft">• <span className="font-semibold">{l.person}</span> ({l.qty})</p>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-dashed border-steel-200 pt-3.5">
        <button onClick={() => onCheckout(tool, 'retiro')} disabled={tool.current <= 0 || blocked}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-clay-500 px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition active:scale-95 hover:bg-clay-600 disabled:opacity-35">
          <Icon name="log-out" size={15}/> Retirar
        </button>
        <button onClick={() => onCheckout(tool, 'ingreso')} disabled={tool.current >= tool.total}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-sage-500 px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition active:scale-95 hover:bg-sage-600 disabled:opacity-35">
          <Icon name="log-in" size={15}/> Ingresar
        </button>
      </div>
      {blocked && <p className="mt-2 text-[11px] text-ink-mute">Retiros bloqueados: herramienta {st.label.toLowerCase()}.</p>}
    </div>
  );
}
