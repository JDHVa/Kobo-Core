import React from 'react';
import * as Lucide from 'lucide-react';
import { TOOL_ICON_LIBRARY } from '../constants/toolIcons';
import { statusOf } from '../lib/utils';

const pascal = (name) => (name || '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

export function Icon({ name, size = 20, className = '', strokeWidth = 2 }) {
  const Cmp = Lucide[pascal(name)] || Lucide.Circle;
  return <Cmp size={size} strokeWidth={strokeWidth} className={`inline-block shrink-0 ${className}`} aria-hidden="true" />;
}

export function ToolIconDisplay({ icon, iconUrl, size = 24, className = '' }) {
  if (iconUrl) {
    return <img src={iconUrl} width={size} height={size} className={`object-contain rounded ${className}`} onError={e => { e.target.style.display = 'none'; }} />;
  }
  const entry = TOOL_ICON_LIBRARY.find(i => i.key === icon);
  if (!entry) return <Icon name="package" size={size} strokeWidth={1.8} className={className} />;
  if (entry.lucide) return <Icon name={entry.lucide} size={size} strokeWidth={1.8} className={className} />;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${entry.svg}</svg>` }}
    />
  );
}

export function StatusBadge({ tool }) {
  const s = statusOf(tool);
  if (s.key === 'full') return <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-semibold text-sage-600"><Icon name="check-circle" size={13}/> Completo</span>;
  if (s.key === 'empty') return <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-100 px-2.5 py-1 text-xs font-semibold text-clay-600"><Icon name="alert-circle" size={13}/> Sin existencias</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><Icon name="hand" size={13}/> {s.missing} fuera</span>;
}

export function StockBar({ tool }) {
  const s = statusOf(tool);
  const tone = s.key === 'full' ? 'bg-sage-400' : s.key === 'empty' ? 'bg-clay-400' : 'bg-amber-400';
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-mute mb-1.5">
        <span className="font-medium">Disponibles</span>
        <span className="font-semibold text-ink-soft tabular-nums">{tool.current} <span className="text-ink-mute">/ {tool.total}</span></span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-steel-100">
        <div className={`h-full rounded-full ${tone} transition-all duration-500 ease-out`} style={{ width: `${s.pct}%` }} />
      </div>
      {tool.minStock > 0 && (
        <p className={`mt-1 text-[11px] ${tool.current < tool.minStock ? 'font-semibold text-clay-600' : 'text-ink-mute'}`}>
          Mínimo: {tool.minStock}{tool.current < tool.minStock ? ' · ¡Reponer!' : ''}
        </p>
      )}
    </div>
  );
}

export function QtyStepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value-1))} disabled={value<=min} className="grid h-10 w-10 place-items-center rounded-xl border border-steel-200 bg-white text-ink-soft shadow-soft transition active:scale-90 hover:bg-steel-50 disabled:opacity-35"><Icon name="minus" size={18}/></button>
      <span className="w-8 text-center text-lg font-bold tabular-nums text-ink">{value}</span>
      <button onClick={() => onChange(Math.min(max, value+1))} disabled={value>=max} className="grid h-10 w-10 place-items-center rounded-xl border border-steel-200 bg-white text-ink-soft shadow-soft transition active:scale-90 hover:bg-steel-50 disabled:opacity-35"><Icon name="plus" size={18}/></button>
    </div>
  );
}

export function MetricCard({ icon, label, value, tone, onClick, alert }) {
  const map = { steel:'bg-steel-100 text-steel-700', sage:'bg-sage-100 text-sage-600', clay:'bg-clay-100 text-clay-600', amber:'bg-amber-100 text-amber-700' };
  const Wrap = onClick ? 'button' : 'div';
  return (
    <Wrap onClick={onClick} className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-soft ${alert ? 'border-clay-300 ring-1 ring-clay-200' : 'border-steel-200'} ${onClick ? 'transition hover:shadow-lift cursor-pointer' : ''}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${map[tone]}`}><Icon name={icon} size={19}/></span>
      <div className="min-w-0"><p className="font-display text-2xl font-bold leading-none text-ink tabular-nums">{value}</p><p className="mt-0.5 truncate text-xs text-ink-mute">{label}</p></div>
    </Wrap>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-steel-200 bg-steel-50/40 px-6 py-12 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-steel-100 text-steel-400"><Icon name={icon} size={28}/></span>
      <h3 className="font-display text-lg font-semibold text-ink-soft">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-ink-mute">{subtitle}</p>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  const tone = toast.type === 'add' ? 'bg-sage-500' : toast.type === 'take' ? 'bg-clay-500' : 'bg-steel-800';
  const icon = toast.type === 'add' ? 'log-in' : toast.type === 'take' ? 'log-out' : 'check';
  return <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"><div className={`animate-fade-up flex items-center gap-2 rounded-full ${tone} px-4 py-2.5 text-sm font-semibold text-white shadow-lift`}><Icon name={icon} size={16}/> {toast.message}</div></div>;
}

export function BreadcrumbNav({ trail, onJump }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {trail.map((node, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={15} className="text-ink-mute"/>}
          <button onClick={() => onJump(i)} className={`rounded-lg px-2 py-1 font-medium transition ${i === trail.length-1 ? 'text-ink' : 'text-ink-mute hover:bg-steel-100 hover:text-steel-700'}`}>{node.label}</button>
        </React.Fragment>
      ))}
    </nav>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm animate-scale-in rounded-3xl bg-white p-6 shadow-lift" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-clay-100 text-clay-600"><Icon name="alert-triangle" size={24}/></div>
        <h3 className="text-center font-display text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-center text-sm text-ink-mute">{message}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-steel-200 bg-white py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-steel-50">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-clay-500 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-600">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// Cáscara de modal compartida (header sticky + footer)
export function ModalShell({ open, onClose, title, icon, subtitle, footer, children, maxW = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full ${maxW} animate-scale-in overflow-y-auto rounded-t-3xl bg-steel-50 shadow-lift sm:rounded-3xl`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-steel-200 bg-steel-50/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-ink"><Icon name={icon} size={20} className="text-steel-600"/> {title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute transition hover:bg-steel-100"><Icon name="x" size={20}/></button>
        </div>
        {children}
        {footer && <div className="sticky bottom-0 flex gap-3 border-t border-steel-200 bg-steel-50/95 p-5 backdrop-blur">{footer}</div>}
      </div>
    </div>
  );
}

export const fieldCls = 'w-full rounded-xl border border-steel-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-soft outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200';
export const lblCls = 'mb-1.5 block text-xs font-semibold text-ink-soft';
export const btnPrimary = 'rounded-xl bg-steel-800 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900';
export const btnGhost = 'rounded-xl border border-steel-200 bg-white py-3 text-sm font-semibold text-ink-soft transition hover:bg-steel-100';
