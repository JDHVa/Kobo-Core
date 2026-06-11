import { useState, useEffect } from 'react';
import { Icon, ToolIconDisplay, ModalShell, fieldCls, lblCls, btnPrimary, btnGhost } from '../ui';
import { CATEGORIES, CONTAINER_META, getDrawerLabel } from '../../constants';
import { TOOL_ICON_LIBRARY } from '../../constants/toolIcons';
import { uid } from '../../lib/utils';

export function ToolModal({ open, onClose, onSave, initial, containers, customIcons = [], defaultLocation }) {
  const blank = { name:'', category:CATEGORIES[0], serial:'', total:1, current:1, minStock:0, status:'ok', container:containers[0]?.id || '', drawer:0, icon:'', iconUrl:'' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [showIcons, setShowIcons] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...blank, ...initial } : { ...blank, ...(defaultLocation || {}), container: defaultLocation?.container || containers[0]?.id || '' });
      setError(''); setShowIcons(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const activeContainer = containers.find(c => c.id === form.container);
  const maxDrawer = activeContainer ? activeContainer.drawers : 1;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio.');
    if (!form.container) return setError('Selecciona un contenedor.');
    const total = Math.max(1, parseInt(form.total) || 1);
    let current = parseInt(form.current);
    if (isNaN(current) || current < 0) current = 0;
    if (current > total) current = total;
    onSave({
      ...form,
      id: form.id || uid(),
      name: form.name.trim(),
      serial: form.serial.trim(),
      total, current,
      minStock: Math.max(0, parseInt(form.minStock) || 0),
      drawer: Math.min(parseInt(form.drawer) || 0, maxDrawer - 1),
      icon: form.icon || '',
      iconUrl: form.icon === 'custom' ? (form.iconUrl || '') : '',
      iconLabel: form.icon === 'custom' ? (form.iconLabel || '') : '',
    }, { isNew: !initial });
  };

  return (
    <ModalShell open={open} onClose={onClose}
      title={initial ? 'Editar herramienta' : 'Registrar herramienta'}
      icon={initial ? 'pencil' : 'plus-circle'}
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} className={`flex-1 ${btnPrimary}`}>{initial ? 'Guardar cambios' : 'Registrar'}</button>
      </>}>
      <div className="space-y-4 p-5">
        {error && <div className="flex items-center gap-2 rounded-xl bg-clay-100 px-3 py-2.5 text-sm font-medium text-clay-600"><Icon name="alert-circle" size={16}/> {error}</div>}

        <div>
          <label className={lblCls}>Nombre de la herramienta</label>
          <input className={fieldCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Taladro percutor 18V" autoFocus/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Categoria</label><select className={fieldCls} value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className={lblCls}>Numero de serie</label><input className={fieldCls} value={form.serial} onChange={e => set('serial', e.target.value)} placeholder="Opcional"/></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><label className={lblCls}>Cantidad total</label><input type="number" min="1" className={fieldCls} value={form.total} onChange={e => set('total', e.target.value)}/></div>
          <div><label className={lblCls}>Disponibles</label><input type="number" min="0" className={fieldCls} value={form.current} onChange={e => set('current', e.target.value)}/></div>
          <div><label className={lblCls}>Stock mínimo</label><input type="number" min="0" className={fieldCls} value={form.minStock} onChange={e => set('minStock', e.target.value)} title="Si las disponibles bajan de este número, aparece alerta de reorden"/></div>
        </div>
        <p className="-mt-2 text-[11px] text-ink-mute">Stock mínimo: al bajar de ese número la herramienta aparece en el panel "Reponer" (útil para consumibles). 0 = sin alerta.</p>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Contenedor</label><select className={fieldCls} value={form.container} onChange={e => { set('container', e.target.value); set('drawer', 0); }}>{containers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className={lblCls}>{activeContainer ? CONTAINER_META[activeContainer.type]?.drawerLabel || 'Cajon' : 'Cajon'}</label>
            <select className={fieldCls} value={form.drawer} onChange={e => set('drawer', e.target.value)}>
              {Array.from({ length: maxDrawer }).map((_, i) => <option key={i} value={i}>{activeContainer ? getDrawerLabel(activeContainer, i) : `Cajon ${i+1}`}</option>)}
            </select>
          </div>
        </div>

        <div>
          <button onClick={() => setShowIcons(v => !v)} className="flex items-center gap-2 text-sm font-semibold text-steel-600 hover:text-steel-800">
            <Icon name={showIcons ? 'chevron-down' : 'chevron-right'} size={16}/>
            Icono de la herramienta
            {form.icon && form.icon !== 'custom' && <ToolIconDisplay icon={form.icon} size={18}/>}
          </button>
          {showIcons && (
            <div className="mt-3 rounded-2xl border border-steel-200 bg-white p-3">
              {customIcons.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-semibold text-ink-soft">Iconos guardados del equipo</p>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    {customIcons.map(ci => (
                      <button key={ci.id} onClick={() => { set('icon', 'custom'); set('iconUrl', ci.url); }}
                        className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${form.icon === 'custom' && form.iconUrl === ci.url ? 'bg-steel-100 ring-2 ring-steel-400' : 'hover:bg-steel-50'}`}>
                        <img src={ci.url} className="h-6 w-6 object-contain rounded" onError={e => e.target.style.display='none'}/>
                        <span className="text-[9px] text-ink-mute leading-tight text-center truncate w-full">{ci.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="mb-2 text-xs font-semibold text-ink-soft">Iconos predefinidos</p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                <button onClick={() => { set('icon', ''); set('iconUrl', ''); }}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${!form.icon ? 'bg-steel-100 ring-2 ring-steel-400' : 'hover:bg-steel-50'}`}>
                  <Icon name="x" size={20} className="text-ink-mute"/>
                  <span className="text-[9px] text-ink-mute">Ninguno</span>
                </button>
                {TOOL_ICON_LIBRARY.map(ic => (
                  <button key={ic.key} onClick={() => { set('icon', ic.key); if (ic.key !== 'custom') set('iconUrl', ''); }}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${form.icon === ic.key ? 'bg-steel-100 ring-2 ring-steel-400' : 'hover:bg-steel-50'}`}>
                    <ToolIconDisplay icon={ic.key} size={22}/>
                    <span className="text-[9px] text-ink-mute leading-tight text-center">{ic.label}</span>
                  </button>
                ))}
              </div>
              {form.icon === 'custom' && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className={lblCls}>URL de la imagen</label>
                    <input className={fieldCls} value={form.iconUrl || ''} onChange={e => set('iconUrl', e.target.value)} placeholder="https://ejemplo.com/imagen.png"/>
                  </div>
                  <div>
                    <label className={lblCls}>Nombre del icono (se guarda para el equipo)</label>
                    <input className={fieldCls} value={form.iconLabel || ''} onChange={e => set('iconLabel', e.target.value)} placeholder="Ej. Resistencia 10k"/>
                  </div>
                  {form.iconUrl && <div className="mt-2 flex justify-center"><img src={form.iconUrl} className="h-16 w-16 rounded-lg border border-steel-200 object-contain" onError={e => e.target.style.display='none'}/></div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
