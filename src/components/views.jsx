import React, { useMemo } from 'react';
import { Icon, BreadcrumbNav, EmptyState } from './ui';
import { ToolCard } from './ToolCard';
import { CONTAINER_META, ACCENT_BG, ACCENT_PILL, DRAWER_TONE, getDrawerLabel } from '../constants';
import { loansByTool } from '../lib/loans';

function Drawer({ label, count, missing, accent, onClick }) {
  const tone = DRAWER_TONE[accent] || DRAWER_TONE.steel;
  return (
    <button onClick={onClick} className="group relative block w-full text-left focus:outline-none">
      <div className={`relative flex items-center gap-3 overflow-hidden rounded-lg border bg-gradient-to-b ${tone} px-4 shadow-drawer transition-all duration-300 group-hover:translate-x-1.5`} style={{ height:'clamp(48px,9vw,60px)' }}>
        <span className="absolute right-3 top-1/2 h-2.5 w-12 -translate-y-1/2 rounded-full bg-black/15 shadow-inner sm:w-16"/>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/55 text-ink-soft"><Icon name="folder" size={17}/></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-soft">{label}</p>
          <p className="text-[11px] text-ink-mute">{count} {count===1?'herramienta':'herramientas'}</p>
        </div>
        {missing > 0 && <span className="absolute right-20 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-white sm:flex">{missing} fuera</span>}
      </div>
    </button>
  );
}

export function StorageContainer({ container, tools, onOpen }) {
  const meta = CONTAINER_META[container.type];
  const drawerData = useMemo(() => Array.from({ length: container.drawers }).map((_, i) => {
    const inD = tools.filter(t => t.container === container.id && t.drawer === i);
    return { count: inD.length, missing: inD.reduce((a,t) => a + (t.total-t.current), 0) };
  }), [container, tools]);
  if (!meta) return null;
  const totalTools = drawerData.reduce((a,d) => a+d.count, 0);
  const totalMissing = drawerData.reduce((a,d) => a+d.missing, 0);

  return (
    <div className="animate-scale-in rounded-3xl border border-steel-200 bg-white p-5 shadow-soft transition hover:shadow-lift">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl ${ACCENT_BG[meta.accent]}`}><Icon name={meta.icon} size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">{container.name}</h3>
            <p className="text-xs text-ink-mute">{meta.label} · {container.drawers} {container.drawers===1?'seccion':'secciones'}</p>
          </div>
        </div>
        {totalMissing > 0
          ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><Icon name="alert-triangle" size={13}/> {totalMissing} fuera</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-semibold text-sage-600"><Icon name="check" size={13}/> Todo en sitio</span>
        }
      </div>
      <div className="rounded-2xl border-2 border-steel-200 bg-gradient-to-b from-steel-50 to-white p-3">
        <div className="rounded-xl bg-steel-100/50 p-2.5">
          <div className="flex flex-col gap-2">
            {drawerData.map((d,i) => <Drawer key={i} label={getDrawerLabel(container,i)} count={d.count} missing={d.missing} accent={meta.accent} onClick={() => onOpen(container, i)}/>)}
          </div>
        </div>
        {container.type !== 'caja' && container.type !== 'repisa' && (
          <div className="mt-2 flex justify-between px-3"><span className="h-3 w-3 rounded-b-md bg-steel-300"/><span className="h-3 w-3 rounded-b-md bg-steel-300"/></div>
        )}
      </div>
      <button onClick={() => onOpen(container, 0)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-steel-200 bg-steel-50 py-2.5 text-sm font-semibold text-steel-700 transition hover:bg-steel-100">
        <Icon name="maximize-2" size={15}/> Explorar {totalTools} herramientas
      </button>
    </div>
  );
}

export function ContainerView({ container, tools, trail, onJump, onOpenDrawer, onBack, onEditDrawers }) {
  const meta = CONTAINER_META[container.type];
  const drawerData = useMemo(() => Array.from({ length: container.drawers }).map((_, i) => {
    const inD = tools.filter(t => t.container === container.id && t.drawer === i);
    return { count: inD.length, missing: inD.reduce((a,t) => a+(t.total-t.current),0), units: inD.reduce((a,t) => a+t.total,0) };
  }), [container, tools]);
  if (!meta) return null;

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between gap-3">
        <BreadcrumbNav trail={trail} onJump={onJump}/>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-ink-soft shadow-soft transition hover:bg-steel-50"><Icon name="arrow-left" size={15}/> Volver</button>
      </div>
      <div className="rounded-3xl border border-steel-200 bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${ACCENT_BG[meta.accent]}`}><Icon name={meta.icon} size={24}/></span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-ink">{container.name}</h2>
            <p className="text-sm text-ink-mute">{meta.label} · selecciona una seccion</p>
          </div>
          <button onClick={onEditDrawers} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50"><Icon name="settings-2" size={15}/> <span className="hidden sm:inline">Editar secciones</span></button>
        </div>
        <div className="mx-auto max-w-md rounded-2xl border-2 border-steel-200 bg-gradient-to-b from-steel-50 to-white p-4">
          <div className="rounded-xl bg-steel-100/50 p-3">
            <div className="flex flex-col gap-2.5">
              {drawerData.map((d,i) => (
                <button key={i} onClick={() => onOpenDrawer(i)} className="group relative block w-full text-left focus:outline-none">
                  <div className="metal-face relative flex items-center gap-3 overflow-hidden rounded-lg border border-steel-300 px-4 shadow-drawer transition-all duration-300 group-hover:translate-x-2" style={{ height:'clamp(58px,11vw,72px)' }}>
                    <span className="absolute right-4 top-1/2 h-3 w-16 -translate-y-1/2 rounded-full bg-black/15 shadow-inner"/>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/70 text-steel-700"><Icon name="folder" size={18}/></span>
                    <div><p className="font-semibold text-ink">{getDrawerLabel(container,i)}</p><p className="text-xs text-ink-mute">{d.count} herramientas · {d.units} unidades</p></div>
                    {d.missing > 0 && <span className="absolute right-24 top-1/2 -translate-y-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">{d.missing} fuera</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {container.type !== 'caja' && container.type !== 'repisa' && (
            <div className="mt-2.5 flex justify-between px-4"><span className="h-4 w-4 rounded-b-lg bg-steel-300"/><span className="h-4 w-4 rounded-b-lg bg-steel-300"/></div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DrawerView({ container, drawerIndex, tools, openLoans, trail, onJump, onChangeDrawer, onCheckout, onEdit, onDelete, onSetStatus, onAddHere, onBack }) {
  const meta = CONTAINER_META[container.type];
  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between gap-3">
        <BreadcrumbNav trail={trail} onJump={onJump}/>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-ink-soft shadow-soft transition hover:bg-steel-50"><Icon name="arrow-left" size={15}/> Volver</button>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-mute">Secciones:</span>
        {Array.from({ length: container.drawers }).map((_, i) => (
          <button key={i} onClick={() => onChangeDrawer(i)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${i===drawerIndex ? `${ACCENT_PILL[meta?.accent] || 'bg-steel-500'} text-white shadow-soft` : 'border border-steel-200 bg-white text-ink-soft hover:bg-steel-50'}`}>
            {getDrawerLabel(container, i)}
          </button>
        ))}
      </div>
      <div className="mb-5 overflow-hidden rounded-3xl border border-steel-200 bg-white shadow-soft">
        <div className="wood-grain flex items-center gap-3 border-b border-steel-200 px-5 py-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/70 text-wood-400"><Icon name="folder-open" size={22}/></span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-ink">{getDrawerLabel(container, drawerIndex)}</h2>
            <p className="text-sm text-ink-soft">{container.name} · {tools.length} {tools.length===1?'herramienta':'herramientas'}</p>
          </div>
          <button onClick={onAddHere} className="flex items-center gap-1.5 rounded-xl bg-steel-800 px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900"><Icon name="plus" size={16}/> <span className="hidden sm:inline">Agregar aqui</span></button>
        </div>
        <div className="p-5">
          {tools.length === 0
            ? <EmptyState icon="inbox" title="Seccion vacia" subtitle="Aun no hay herramientas registradas en esta seccion."/>
            : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tools.map(t => <ToolCard key={t.id} tool={t} loans={loansByTool(openLoans, t.id)} onCheckout={onCheckout} onEdit={onEdit} onDelete={onDelete} onSetStatus={onSetStatus}/>)}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
