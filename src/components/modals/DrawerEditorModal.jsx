import { useState, useEffect } from 'react';
import { Icon, ModalShell, btnPrimary, btnGhost } from '../ui';
import { CONTAINER_META } from '../../constants';

export function DrawerEditorModal({ open, container, toolCounts, onClose, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (open && container) {
      setRows(Array.from({ length: container.drawers }).map((_, i) => ({
        orig: i, name: (container.drawerNames && container.drawerNames[i]) || '',
      })));
    }
  }, [open, container]);

  if (!open || !container) return null;
  const meta = CONTAINER_META[container.type];
  const field = 'w-full rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200';

  const move = (from, to) => {
    if (to < 0 || to >= rows.length) return;
    setRows(prev => { const n = prev.slice(); const [item] = n.splice(from,1); n.splice(to,0,item); return n; });
  };
  const setName = (i, value) => setRows(prev => prev.map((r,idx) => idx===i ? {...r, name:value} : r));
  const addDrawer = () => { if (rows.length < (meta?.maxD || 30)) setRows(prev => [...prev, { orig: -1, name: '' }]); };
  const removeDrawer = (i) => { if (rows.length > (meta?.minD || 1)) setRows(prev => prev.filter((_,idx) => idx !== i)); };

  const submit = () => onSave(container.id, rows.map(r => r.name.trim()), rows.map(r => r.orig), rows.length);

  return (
    <ModalShell open={open} onClose={onClose} title="Editar secciones" icon="settings-2" subtitle={container.name}
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} className={`flex-1 ${btnPrimary}`}>Guardar cambios</button>
      </>}>
      <div className="space-y-2.5 p-5">
        <p className="mb-1 text-xs text-ink-mute">Renombra, reordena, agrega o quita secciones. Las herramientas se mueven con su seccion; si borras una seccion con herramientas, pasan a la primera.</p>
        {rows.map((r, i) => (
          <div key={`${r.orig}-${i}`} className="flex items-center gap-2 rounded-2xl border border-steel-200 bg-white p-2.5 shadow-soft">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, i-1)} disabled={i===0} className="grid h-7 w-7 place-items-center rounded-lg text-ink-mute transition hover:bg-steel-50 disabled:opacity-25"><Icon name="chevron-up" size={16}/></button>
              <button onClick={() => move(i, i+1)} disabled={i===rows.length-1} className="grid h-7 w-7 place-items-center rounded-lg text-ink-mute transition hover:bg-steel-50 disabled:opacity-25"><Icon name="chevron-down" size={16}/></button>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-steel-100 text-steel-600 text-sm font-bold tabular-nums">{i+1}</span>
            <div className="min-w-0 flex-1">
              <input className={field} value={r.name} onChange={e => setName(i, e.target.value)} placeholder={`${meta?.drawerLabel || 'Seccion'} ${i+1}`}/>
              <p className="mt-1 px-1 text-[11px] text-ink-mute">{r.orig >= 0 ? `${toolCounts[r.orig] || 0} herramientas` : 'Nueva seccion'}</p>
            </div>
            <button onClick={() => removeDrawer(i)} disabled={rows.length <= (meta?.minD || 1)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-mute transition hover:bg-clay-50 hover:text-clay-600 disabled:opacity-25">
              <Icon name="trash-2" size={15}/>
            </button>
          </div>
        ))}
        <button onClick={addDrawer} disabled={rows.length >= (meta?.maxD || 30)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-steel-200 bg-steel-50/50 py-3 text-sm font-semibold text-steel-600 transition hover:border-steel-300 hover:bg-steel-100 disabled:opacity-35">
          <Icon name="plus" size={16}/> Agregar {meta?.drawerLabel?.toLowerCase() || 'seccion'}
        </button>
      </div>
    </ModalShell>
  );
}
