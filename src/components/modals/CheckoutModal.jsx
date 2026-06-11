import React, { useState, useEffect } from 'react';
import { Icon, QtyStepper, ModalShell, fieldCls, lblCls, btnGhost } from '../ui';
import { loadRecentPeople } from '../../lib/storage';

// Modal de retiro/devolución con responsable (tool checkout — práctica de pits FIRST)
export function CheckoutModal({ open, mode, tool, onClose, onConfirm, defaultPerson = '' }) {
  const isTake = mode === 'retiro';
  const [qty, setQty] = useState(1);
  const [person, setPerson] = useState('');
  const [note, setNote] = useState('');
  const recent = loadRecentPeople();

  useEffect(() => { if (open) { setQty(1); setPerson(defaultPerson); setNote(''); } }, [open, tool?.id]);
  if (!open || !tool) return null;

  const max = isTake ? tool.current : tool.total - tool.current;

  const submit = () => {
    onConfirm({ toolId: tool.id, type: mode, qty: Math.min(qty, max), person: person.trim(), note: note.trim() });
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} maxW="max-w-md"
      title={isTake ? 'Retirar herramienta' : 'Devolver / Ingresar'}
      icon={isTake ? 'log-out' : 'log-in'} subtitle={tool.name}
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} disabled={max <= 0 || (isTake && !person.trim())}
          className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-soft transition disabled:opacity-40 ${isTake ? 'bg-clay-500 hover:bg-clay-600' : 'bg-sage-500 hover:bg-sage-600'}`}>
          {isTake ? 'Retirar' : 'Ingresar'}
        </button>
      </>}>
      <div className="space-y-4 p-5">
        <div>
          <label className={lblCls}>Cantidad (máx. {max})</label>
          <QtyStepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty}/>
        </div>
        <div>
          <label className={lblCls}>{isTake ? '¿Quién se la lleva? *' : '¿Quién la devuelve?'}</label>
          <input className={fieldCls} value={person} onChange={e => setPerson(e.target.value)}
            placeholder="Nombre de la persona" list="recent-people" autoFocus/>
          <datalist id="recent-people">{recent.map(p => <option key={p} value={p}/>)}</datalist>
          {recent.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recent.slice(0, 6).map(p => (
                <button key={p} onClick={() => setPerson(p)} className="rounded-full border border-steel-200 bg-white px-2.5 py-1 text-xs text-ink-soft hover:bg-steel-50">{p}</button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={lblCls}>Motivo / nota (opcional)</label>
          <input className={fieldCls} value={note} onChange={e => setNote(e.target.value)} placeholder={isTake ? 'Ej. Ensamble del drivetrain' : 'Ej. Trabajo terminado'}/>
        </div>
        {isTake && !person.trim() && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700"><Icon name="info" size={13}/> El nombre es obligatorio para saber quién tiene la herramienta.</p>
        )}
      </div>
    </ModalShell>
  );
}
