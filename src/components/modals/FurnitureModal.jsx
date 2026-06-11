import React, { useState, useEffect } from 'react';
import { Icon, QtyStepper, ModalShell, fieldCls, lblCls, btnPrimary, btnGhost } from '../ui';
import { CONTAINER_META, CUSTOM_SHAPES, FURNITURE_COLORS } from '../../constants';
import { uid, snap, clamp } from '../../lib/utils';

export function FurnitureModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({ type:'gabinete', name:'', drawers:4, shape:'rect' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ type:editing.type, name:editing.name, drawers:editing.drawers, shape:editing.shape||'rect' });
    else setForm({ type:'gabinete', name:'', drawers: CONTAINER_META.gabinete.defaultDrawers, shape:'rect' });
    setError('');
  }, [open, editing]);

  if (!open) return null;

  const meta = CONTAINER_META[form.type];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const changeType = (type) => {
    const m = CONTAINER_META[type];
    setForm(f => ({ ...f, type, drawers: clamp(f.drawers, m.minD, m.maxD) }));
  };

  const submit = () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio.');
    const drawers = clamp(form.drawers, meta.minD, meta.maxD);
    const names = editing ? editing.drawerNames.slice(0, drawers) : [];
    while (names.length < drawers) names.push('');
    onSave({
      id: editing?.id || uid(),
      type: form.type,
      name: form.name.trim(),
      drawers, drawerNames: names,
      x: editing?.x ?? snap(400 + Math.random() * 100 - 50),
      y: editing?.y ?? snap(200 + Math.random() * 100 - 50),
      w: editing?.w ?? 170, h: editing?.h ?? 120, z: editing?.z ?? 0,
      shape: form.type === 'personalizado' ? form.shape : 'rect',
    });
  };

  return (
    <ModalShell open={open} onClose={onClose}
      title={editing ? 'Editar mueble' : 'Agregar mueble'} icon={editing ? 'pencil' : 'plus-circle'}
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} className={`flex-1 ${btnPrimary}`}>{editing ? 'Guardar cambios' : 'Agregar'}</button>
      </>}>
      <div className="space-y-4 p-5">
        {error && <div className="flex items-center gap-2 rounded-xl bg-clay-100 px-3 py-2.5 text-sm font-medium text-clay-600"><Icon name="alert-circle" size={16}/> {error}</div>}

        <div>
          <label className={lblCls}>Tipo de mueble</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(CONTAINER_META).map(([key, m]) => {
              const colors = FURNITURE_COLORS[m.accent];
              return (
                <button key={key} onClick={() => changeType(key)}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium transition ${form.type === key ? 'border-steel-600 bg-steel-50 text-ink' : 'border-steel-100 bg-white text-ink-soft hover:border-steel-200'}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{background:colors.fill}}><Icon name={m.icon} size={16} className="text-ink-soft"/></span>
                  <span className="truncate text-xs">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={lblCls}>Nombre</label>
          <input className={fieldCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder={`Ej. ${meta.label} Principal`} autoFocus/>
        </div>

        {form.type === 'personalizado' && (
          <div>
            <label className={lblCls}>Forma en el mapa</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CUSTOM_SHAPES.map(s => (
                <button key={s.key} onClick={() => set('shape', s.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${form.shape === s.key ? 'border-steel-600 bg-steel-50' : 'border-steel-100 bg-white hover:border-steel-200'}`}>
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-steel-500" stroke="currentColor" strokeWidth="1.5">
                    <path d={s.preview} fill="currentColor" opacity="0.2"/><path d={s.preview} fill="none"/>
                  </svg>
                  <span className="text-[10px] text-ink-mute">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={lblCls}>{meta.drawerLabel}s ({meta.minD}-{meta.maxD})</label>
          <div className="flex items-center gap-3">
            <QtyStepper value={form.drawers} min={meta.minD} max={meta.maxD} onChange={v => set('drawers', v)}/>
            <span className="text-sm text-ink-mute">{form.drawers} {form.drawers === 1 ? meta.drawerLabel.toLowerCase() : (meta.drawerLabel.toLowerCase() + 's')}</span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
