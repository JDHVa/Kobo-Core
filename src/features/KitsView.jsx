import React, { useState, useMemo } from 'react';
import { Icon, ToolIconDisplay, EmptyState, ModalShell, fieldCls, lblCls, btnPrimary, btnGhost } from '../components/ui';
import { uid } from '../lib/utils';

// Kits de empaque (pack-out checklists — práctica de equipos FIRST top para competencias)
function KitModal({ open, onClose, onSave, editing, tools }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setDescription(editing?.description || '');
      setItems(editing?.items ? [...editing.items] : []);
      setSearch('');
    }
  }, [open, editing]);

  if (!open) return null;

  const itemQty = (toolId) => items.find(i => i.toolId === toolId)?.qty || 0;
  const setQty = (toolId, qty) => {
    setItems(prev => {
      const rest = prev.filter(i => i.toolId !== toolId);
      return qty > 0 ? [...rest, { toolId, qty }] : rest;
    });
  };

  const q = search.trim().toLowerCase();
  const visible = q ? tools.filter(t => t.name.toLowerCase().includes(q)) : tools;

  const submit = () => {
    if (!name.trim() || items.length === 0) return;
    onSave({ id: editing?.id || uid(), name: name.trim(), description: description.trim(), items });
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Editar kit' : 'Nuevo kit'} icon="package-check"
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} disabled={!name.trim() || items.length === 0} className={`flex-1 ${btnPrimary} disabled:opacity-40`}>Guardar kit</button>
      </>}>
      <div className="space-y-4 p-5">
        <div><label className={lblCls}>Nombre del kit</label><input className={fieldCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Kit de competencia regional" autoFocus/></div>
        <div><label className={lblCls}>Descripción (opcional)</label><input className={fieldCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Todo lo necesario para el pit"/></div>
        <div>
          <label className={lblCls}>Herramientas ({items.length} en el kit)</label>
          <input className={`${fieldCls} mb-2`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar herramienta..."/>
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-steel-200 bg-white p-2">
            {visible.map(t => {
              const qty = itemQty(t.id);
              return (
                <div key={t.id} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${qty > 0 ? 'bg-steel-50' : ''}`}>
                  <ToolIconDisplay icon={t.icon} iconUrl={t.iconUrl} size={20} className="text-steel-600"/>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(t.id, Math.max(0, qty-1))} className="grid h-7 w-7 place-items-center rounded-lg border border-steel-200 text-ink-soft hover:bg-steel-50"><Icon name="minus" size={13}/></button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                    <button onClick={() => setQty(t.id, Math.min(t.total, qty+1))} className="grid h-7 w-7 place-items-center rounded-lg border border-steel-200 text-ink-soft hover:bg-steel-50"><Icon name="plus" size={13}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function KitCard({ kit, tools, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [packed, setPacked] = useState({}); // toolId -> bool (checklist local de empaque)

  const rows = useMemo(() => kit.items.map(item => {
    const tool = tools.find(t => t.id === item.toolId);
    return { ...item, tool, ok: tool ? tool.current >= item.qty : false };
  }), [kit, tools]);

  const ready = rows.every(r => r.ok);
  const packedCount = rows.filter(r => packed[r.toolId]).length;

  return (
    <div className="rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${ready ? 'bg-sage-100 text-sage-600' : 'bg-amber-100 text-amber-700'}`}>
            <Icon name={ready ? 'package-check' : 'package-x'} size={22}/>
          </span>
          <div className="min-w-0">
            <h4 className="truncate font-display text-lg font-semibold text-ink">{kit.name}</h4>
            <p className="truncate text-xs text-ink-mute">{kit.description || `${kit.items.length} herramientas`} · {ready ? 'Disponible completo' : 'Faltan items'}</p>
          </div>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} className="ml-auto shrink-0 text-ink-mute"/>
        </button>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => onEdit(kit)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-steel-50 hover:text-steel-700"><Icon name="pencil" size={15}/></button>
          <button onClick={() => onDelete(kit.id)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-clay-50 hover:text-clay-600"><Icon name="trash-2" size={15}/></button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-1.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-soft">Checklist de empaque · {packedCount}/{rows.length}</p>
            {packedCount > 0 && <button onClick={() => setPacked({})} className="text-xs font-medium text-steel-600 hover:text-steel-800">Reiniciar</button>}
          </div>
          {rows.map(r => (
            <label key={r.toolId} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${packed[r.toolId] ? 'border-sage-200 bg-sage-50/60' : 'border-steel-100 bg-white'}`}>
              <input type="checkbox" checked={!!packed[r.toolId]} onChange={e => setPacked(p => ({ ...p, [r.toolId]: e.target.checked }))}
                className="h-4 w-4 accent-[#52804f]"/>
              {r.tool && <ToolIconDisplay icon={r.tool.icon} iconUrl={r.tool.iconUrl} size={18} className="text-steel-600"/>}
              <span className={`min-w-0 flex-1 truncate text-sm ${packed[r.toolId] ? 'text-ink-mute line-through' : 'text-ink'}`}>
                {r.tool?.name || '(herramienta eliminada)'} × {r.qty}
              </span>
              {!r.ok && <span className="shrink-0 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-bold text-clay-600">solo {r.tool?.current ?? 0} disp.</span>}
            </label>
          ))}
          {packedCount === rows.length && rows.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-sage-100 py-2.5 text-sm font-semibold text-sage-600"><Icon name="check-circle" size={16}/> ¡Kit completo y empacado!</p>
          )}
        </div>
      )}
    </div>
  );
}

export function KitsView({ kits, tools, onSaveKit, onDeleteKit }) {
  const [modal, setModal] = useState({ open:false, editing:null });

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sage-100 text-sage-600"><Icon name="boxes" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Kits de empaque</h3>
            <p className="text-xs text-ink-mute">Listas de verificación para competencias y trabajos (pack-out)</p>
          </div>
        </div>
        <button onClick={() => setModal({ open:true, editing:null })} className="flex items-center gap-1.5 rounded-xl bg-steel-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900">
          <Icon name="plus" size={16}/> Nuevo kit
        </button>
      </div>
      {(!kits || kits.length === 0)
        ? <EmptyState icon="boxes" title="Sin kits aún" subtitle="Crea un kit (ej. 'Kit de competencia') y úsalo como checklist antes de salir del taller."/>
        : <div className="space-y-3">{kits.map(k => <KitCard key={k.id} kit={k} tools={tools} onEdit={kit => setModal({ open:true, editing:kit })} onDelete={onDeleteKit}/>)}</div>
      }
      <KitModal open={modal.open} editing={modal.editing} tools={tools} onClose={() => setModal({ open:false, editing:null })} onSave={onSaveKit}/>
    </div>
  );
}
