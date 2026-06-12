import { useState, useEffect } from 'react';
import { Icon, EmptyState, ModalShell, PhotoField, Lightbox, ConfirmDialog, fieldCls, lblCls, btnPrimary, btnGhost } from '../components/ui';
import { uid } from '../lib/utils';

const fmtPrice = (p) => p == null || p === '' ? null
  : new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(p);

function WishModal({ open, editing, onClose, onSave }) {
  const blank = { name:'', price:'', qty:1, url:'', photo:'', note:'' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(editing ? { ...blank, ...editing, price: editing.price ?? '', qty: editing.qty || 1 } : blank);
    setError('');
  }, [open, editing]);
  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio.');
    const price = form.price === '' ? null : parseFloat(form.price);
    if (form.price !== '' && (isNaN(price) || price < 0)) return setError('El precio no es válido.');
    onSave({
      id: editing?.id || uid(),
      name: form.name.trim(),
      price,
      qty: Math.max(1, parseInt(form.qty) || 1),
      url: form.url.trim(),
      photo: form.photo || '',
      note: form.note.trim(),
    });
  };

  const qty = Math.max(1, parseInt(form.qty) || 1);
  const unitPrice = form.price === '' ? null : parseFloat(form.price);
  const subtotal = unitPrice != null && !isNaN(unitPrice) ? unitPrice * qty : null;

  return (
    <ModalShell open={open} onClose={onClose} onSubmit={submit}
      title={editing ? 'Editar material' : 'Material deseado'} icon={editing ? 'pencil' : 'sparkles'}
      footer={<>
        <button onClick={onClose} className={`flex-1 ${btnGhost}`}>Cancelar</button>
        <button onClick={submit} className={`flex-1 ${btnPrimary}`}>{editing ? 'Guardar cambios' : 'Agregar'}</button>
      </>}>
      <div className="space-y-4 p-5">
        {error && <div className="flex items-center gap-2 rounded-xl bg-clay-100 px-3 py-2.5 text-sm font-medium text-clay-600"><Icon name="alert-circle" size={16}/> {error}</div>}
        <div>
          <label className={lblCls}>Nombre</label>
          <input className={fieldCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Impresora 3D Bambu A1" autoFocus/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Precio por unidad</label>
            <input type="number" min="0" step="0.01" className={fieldCls} value={form.price} onChange={e => set('price', e.target.value)} placeholder="Opcional"/>
          </div>
          <div>
            <label className={lblCls}>Cantidad deseada</label>
            <input type="number" min="1" className={fieldCls} value={form.qty} onChange={e => set('qty', e.target.value)}/>
          </div>
        </div>
        {subtotal != null && qty > 1 && (
          <p className="-mt-2 text-xs text-ink-mute">
            {qty} × {fmtPrice(unitPrice)} = <span className="font-semibold text-ink">{fmtPrice(subtotal)}</span>
          </p>
        )}
        <div>
          <label className={lblCls}>URL para comprarlo</label>
          <input className={fieldCls} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..."/>
        </div>
        <PhotoField value={form.photo} onChange={url => set('photo', url)}/>
        <div>
          <label className={lblCls}>Nota (opcional)</label>
          <input className={fieldCls} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Ej. Para el área de prototipado"/>
        </div>
      </div>
    </ModalShell>
  );
}

// Materiales a futuro: lo que el taller quiere comprar / tener algún día
export function WishlistView({ wishlist = [], canEdit, isAdmin, onSave, onDelete }) {
  const [modal, setModal] = useState(null);     // { editing } | null
  const [confirm, setConfirm] = useState(null); // wish a borrar
  const [photo, setPhoto] = useState(null);     // lightbox

  const totalPrice = wishlist.reduce((a, w) => a + (w.price || 0) * (w.qty || 1), 0);

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-100 text-steel-700"><Icon name="sparkles" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Materiales a futuro</h3>
            <p className="text-xs text-ink-mute">
              Lo que el taller quiere tener{totalPrice > 0 && <> · total aprox. <span className="font-semibold">{fmtPrice(totalPrice)}</span></>}
            </p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setModal({ editing:null })} className="flex items-center gap-1.5 rounded-xl bg-steel-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900 active:scale-95">
            <Icon name="plus" size={16}/> Agregar material
          </button>
        )}
      </div>

      {wishlist.length === 0
        ? <EmptyState icon="sparkles" title="Sin materiales deseados" subtitle="Agrega herramientas o equipo que el taller quiera comprar a futuro, con precio y enlace."/>
        : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {wishlist.map(w => (
              <div key={w.id} className="group flex flex-col overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-soft transition hover:shadow-lift">
                {w.photo ? (
                  <button onClick={() => setPhoto(w.photo)} className="block h-36 w-full overflow-hidden bg-steel-50">
                    <img src={w.photo} alt={w.name} className="h-full w-full object-cover transition group-hover:scale-105"/>
                  </button>
                ) : (
                  <div className="grid h-36 w-full place-items-center bg-steel-50 text-steel-300"><Icon name="image" size={36}/></div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-display text-lg font-semibold leading-tight text-ink">{w.name}</h4>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
                        <button onClick={() => setModal({ editing:w })} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-steel-50 hover:text-steel-700"><Icon name="pencil" size={15}/></button>
                        {isAdmin && <button onClick={() => setConfirm(w)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-clay-50 hover:text-clay-600"><Icon name="trash-2" size={15}/></button>}
                      </div>
                    )}
                  </div>
                  {w.note && <p className="mt-1 text-xs text-ink-mute">{w.note}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {w.price != null
                      ? <div className="min-w-0">
                          <span className="font-display text-lg font-bold text-ink tabular-nums">{fmtPrice(w.price * (w.qty || 1))}</span>
                          {(w.qty || 1) > 1 && <p className="text-[11px] text-ink-mute tabular-nums">{w.qty} × {fmtPrice(w.price)} c/u</p>}
                        </div>
                      : <span className="text-xs text-ink-mute">{(w.qty || 1) > 1 ? `${w.qty} unidades · sin precio` : 'Sin precio'}</span>}
                    {w.url && (
                      <a href={w.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-sage-500 px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-600 active:scale-95">
                        <Icon name="shopping-cart" size={14}/> Comprar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      <WishModal open={!!modal} editing={modal?.editing} onClose={() => setModal(null)}
        onSave={w => { onSave(w); setModal(null); }}/>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { onDelete(confirm.id); setConfirm(null); }}
        title="¿Quitar de la lista?" message={confirm ? `"${confirm.name}" se quitará de los materiales a futuro.` : ''}/>
      {photo && <Lightbox src={photo} onClose={() => setPhoto(null)}/>}
    </div>
  );
}
