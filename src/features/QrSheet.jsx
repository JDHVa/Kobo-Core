import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Icon, EmptyState } from '../components/ui';
import { getDrawerLabel } from '../constants';

// QR por herramienta: al escanearlo con la cámara del teléfono abre la app
// directo en el modal de retiro (?tool=ID). Imprime la hoja y pégalas en
// cajones/herramientas — así registrar un retiro toma 5 segundos.
function QrCell({ value, label, sub }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, value, { width: 132, margin: 1, color: { dark: '#1e3a5f' } });
  }, [value]);
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-steel-200 bg-white p-3 break-inside-avoid print:border-gray-400">
      <canvas ref={canvasRef}/>
      <p className="max-w-[140px] truncate text-center text-xs font-bold text-ink">{label}</p>
      {sub && <p className="max-w-[140px] truncate text-center text-[10px] text-ink-mute">{sub}</p>}
    </div>
  );
}

export function QrSheet({ tools, containers }) {
  const [scope, setScope] = useState('all'); // all | containerId
  const base = window.location.origin + window.location.pathname;

  const visible = scope === 'all' ? tools : tools.filter(t => t.container === scope);
  const containerOf = (t) => containers.find(c => c.id === t.container);

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft print:border-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-100 text-steel-700"><Icon name="qr-code" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Etiquetas QR</h3>
            <p className="text-xs text-ink-mute">Imprime y pega en cajones. Escanear con la cámara abre el retiro directo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={scope} onChange={e => setScope(e.target.value)}
            className="rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-medium text-ink-soft shadow-soft outline-none">
            <option value="all">Todas las herramientas</option>
            {containers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-steel-800 px-3.5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900">
            <Icon name="printer" size={16}/> Imprimir
          </button>
        </div>
      </div>

      {visible.length === 0
        ? <EmptyState icon="qr-code" title="Sin herramientas" subtitle="No hay herramientas en este filtro."/>
        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map(t => {
              const c = containerOf(t);
              return <QrCell key={t.id} value={`${base}?tool=${t.id}`} label={t.name}
                sub={c ? `${c.name} · ${getDrawerLabel(c, t.drawer)}` : ''}/>;
            })}
          </div>
      }
    </div>
  );
}
