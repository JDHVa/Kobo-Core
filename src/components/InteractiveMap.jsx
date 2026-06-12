import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Icon } from './ui';
import { CONTAINER_META, FURNITURE_COLORS, DEFAULT_ENTRANCE } from '../constants';
import { snap, clamp } from '../lib/utils';

// Qué etiquetas mostrar sobre el mapa (preferencia por dispositivo)
const MAP_VIS_KEY = 'taller_mapa_visibilidad';
const DEFAULT_VIS = { names:true, counts:true, badges:true };
const VIS_OPTIONS = [
  { key:'names',  label:'Nombres de muebles' },
  { key:'counts', label:'Contador de herramientas' },
  { key:'badges', label:'Alertas de items fuera' },
];
const loadVis = () => {
  try { return { ...DEFAULT_VIS, ...JSON.parse(localStorage.getItem(MAP_VIS_KEY)) }; }
  catch { return DEFAULT_VIS; }
};

// Puerta de acceso al taller: vive en cualquiera de las 4 paredes y en
// modo edición se arrastra (se pega a la pared más cercana).
function Entrance({ entrance, editMode, dragging, onPointerDown }) {
  const { wall = 'bottom', offset = 440, size = 120 } = entrance || {};
  const horizontal = wall === 'top' || wall === 'bottom';
  // hueco en la pared + arco de apertura hacia adentro + etiqueta
  const gap = horizontal
    ? { x: offset, y: wall === 'top' ? 16 : 576, w: size, h: 8 }
    : { x: wall === 'left' ? 16 : 976, y: offset, w: 8, h: size };
  const arc = horizontal
    ? (wall === 'top'
        ? `M${offset} 24 A${size} ${size} 0 0 0 ${offset + size} 24`
        : `M${offset} 576 A${size} ${size} 0 0 1 ${offset + size} 576`)
    : (wall === 'left'
        ? `M24 ${offset} A${size} ${size} 0 0 1 24 ${offset + size}`
        : `M976 ${offset} A${size} ${size} 0 0 0 976 ${offset + size}`);
  const label = horizontal
    ? { x: offset + size/2, y: wall === 'top' ? 14 : 596 }
    : { x: wall === 'left' ? 10 : 990, y: offset + size/2 };
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: editMode ? (dragging ? 'grabbing' : 'grab') : 'default' }}>
      {editMode && <rect x={gap.x - 6} y={gap.y - 6} width={gap.w + 12} height={gap.h + 12} rx={4}
        fill={dragging ? '#f59e0b22' : 'transparent'} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3"/>}
      <rect {...{ x:gap.x, y:gap.y, width:gap.w, height:gap.h }} fill="#eef1f5"/>
      <path d={arc} fill="none" stroke="#9db9d4" strokeWidth="2" strokeDasharray="4 4" style={{pointerEvents:'none'}}/>
      <text x={label.x} y={label.y} textAnchor="middle" fontSize="12" fill="#71717a" style={{pointerEvents:'none'}}
        transform={horizontal ? undefined : `rotate(${wall === 'left' ? -90 : 90} ${label.x} ${label.y})`}>Acceso</text>
    </g>
  );
}

export function InteractiveMap({ containers, tools, editMode, entrance = DEFAULT_ENTRANCE, onCommitEntrance, onUpdateContainer, onCommitContainer, onDeleteContainer, onSelect, onAddFurniture, onEditFurniture }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [entranceDrag, setEntranceDrag] = useState(null); // entrada en movimiento (estado local hasta soltar)
  const [vis, setVis] = useState(loadVis);
  const [visMenu, setVisMenu] = useState(false);
  const toggleVis = (key) => setVis(v => {
    const next = { ...v, [key]: !v[key] };
    localStorage.setItem(MAP_VIS_KEY, JSON.stringify(next));
    return next;
  });

  const stats = useMemo(() => {
    const m = {};
    containers.forEach(c => {
      const inC = tools.filter(t => t.container === c.id);
      m[c.id] = { count: inC.length, missing: inC.reduce((a,t) => a + (t.total - t.current), 0) };
    });
    return m;
  }, [containers, tools]);

  const toSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x:0, y:0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x:0, y:0 };
    return { x: (clientX - ctm.e) / ctm.a, y: (clientY - ctm.f) / ctm.d };
  }, []);

  const handlePointerDown = useCallback((e, cId, action) => {
    if (!editMode) return;
    e.preventDefault(); e.stopPropagation();
    const pt = toSvg(e.clientX, e.clientY);
    const c = containers.find(c => c.id === cId);
    if (!c) return;
    setSelectedId(cId);
    setDrag({ id:cId, action, startX:pt.x, startY:pt.y, origX:c.x, origY:c.y, origW:c.w, origH:c.h });
  }, [editMode, containers, toSvg]);

  // Arrastre de la entrada: se pega a la pared más cercana del perímetro
  const handleEntranceMove = useCallback((e) => {
    const pt = toSvg(e.clientX, e.clientY);
    const size = entrance.size || 120;
    // distancia a cada pared del recinto (20..980 x 20..580)
    const walls = [
      { wall:'top',    d: Math.abs(pt.y - 20),  offset: clamp(pt.x - size/2, 20, 980 - size) },
      { wall:'bottom', d: Math.abs(pt.y - 580), offset: clamp(pt.x - size/2, 20, 980 - size) },
      { wall:'left',   d: Math.abs(pt.x - 20),  offset: clamp(pt.y - size/2, 20, 580 - size) },
      { wall:'right',  d: Math.abs(pt.x - 980), offset: clamp(pt.y - size/2, 20, 580 - size) },
    ];
    const best = walls.reduce((a, b) => (b.d < a.d ? b : a));
    setEntranceDrag({ wall: best.wall, offset: snap(best.offset), size });
  }, [entrance.size, toSvg]);

  const handlePointerMove = useCallback((e) => {
    if (entranceDrag) return handleEntranceMove(e);
    if (!drag) return;
    const pt = toSvg(e.clientX, e.clientY);
    const dx = pt.x - drag.startX, dy = pt.y - drag.startY;
    let upd = {};
    if (drag.action === 'move') {
      upd = { x: snap(clamp(drag.origX + dx, 20, 940)), y: snap(clamp(drag.origY + dy, 20, 540)) };
    } else if (drag.action === 'resize-se') {
      upd = { w: snap(Math.max(60, drag.origW + dx)), h: snap(Math.max(40, drag.origH + dy)) };
    } else if (drag.action === 'resize-sw') {
      const newW = snap(Math.max(60, drag.origW - dx));
      upd = { x: snap(drag.origX + drag.origW - newW), w: newW, h: snap(Math.max(40, drag.origH + dy)) };
    } else if (drag.action === 'resize-ne') {
      const newH = snap(Math.max(40, drag.origH - dy));
      upd = { y: snap(drag.origY + drag.origH - newH), w: snap(Math.max(60, drag.origW + dx)), h: newH };
    } else if (drag.action === 'resize-nw') {
      const newW = snap(Math.max(60, drag.origW - dx));
      const newH = snap(Math.max(40, drag.origH - dy));
      upd = { x: snap(drag.origX + drag.origW - newW), y: snap(drag.origY + drag.origH - newH), w: newW, h: newH };
    }
    onUpdateContainer(drag.id, upd);
  }, [drag, entranceDrag, handleEntranceMove, toSvg, onUpdateContainer]);

  const handlePointerUp = useCallback(() => {
    if (entranceDrag) {
      onCommitEntrance?.(entranceDrag);
      setEntranceDrag(null);
    }
    if (drag && onCommitContainer) {
      const c = containers.find(c => c.id === drag.id);
      if (c) onCommitContainer(c);
    }
    setDrag(null);
  }, [drag, entranceDrag, onCommitEntrance, containers, onCommitContainer]);

  const handleClick = useCallback((e, c) => {
    if (editMode) { setSelectedId(c.id); return; }
    onSelect(c);
  }, [editMode, onSelect]);

  useEffect(() => { if (!editMode) setSelectedId(null); }, [editMode]);

  const renderShape = (c, colors) => {
    const { x, y, w, h, shape } = c;
    const props = { fill:colors.fill, stroke:colors.stroke, strokeWidth:2.5 };
    switch(shape) {
      case 'circle': return <ellipse cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2} {...props}/>;
      case 'lshape': return <path d={`M${x} ${y}L${x+w} ${y}L${x+w} ${y+h*0.45}L${x+w*0.45} ${y+h*0.45}L${x+w*0.45} ${y+h}L${x} ${y+h}Z`} {...props}/>;
      case 'ushape': return <path d={`M${x} ${y}L${x+w*0.25} ${y}L${x+w*0.25} ${y+h*0.7}L${x+w*0.75} ${y+h*0.7}L${x+w*0.75} ${y}L${x+w} ${y}L${x+w} ${y+h}L${x} ${y+h}Z`} {...props}/>;
      case 'triangle': return <polygon points={`${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}`} {...props}/>;
      case 'diamond': return <polygon points={`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`} {...props}/>;
      default: return <rect x={x} y={y} width={w} height={h} rx={8} {...props}/>;
    }
  };

  const renderDecoration = (c, colors) => {
    const { x, y, w, h, type, drawers } = c;
    const els = [];
    if (type === 'gabinete' || type === 'multiple' || type === 'estante') {
      for (let i = 1; i < drawers; i++) {
        const ly = y + (h / drawers) * i;
        els.push(<line key={`dl${i}`} x1={x+10} y1={ly} x2={x+w-10} y2={ly} stroke={colors.stroke} strokeWidth={1} opacity={0.35}/>);
      }
      for (let i = 0; i < drawers; i++) {
        const cy = y + (h / drawers) * (i + 0.5);
        els.push(<line key={`dh${i}`} x1={x+w/2-10} y1={cy} x2={x+w/2+10} y2={cy} stroke={colors.stroke} strokeWidth={2} strokeLinecap="round" opacity={0.4}/>);
      }
      if (type === 'estante') {
        els.push(<line key="el" x1={x} y1={y} x2={x} y2={y+h} stroke={colors.stroke} strokeWidth={2.5}/>);
        els.push(<line key="er" x1={x+w} y1={y} x2={x+w} y2={y+h} stroke={colors.stroke} strokeWidth={2.5}/>);
      }
    } else if (type === 'caja') {
      els.push(<path key="handle" d={`M${x+w*0.3} ${y} Q${x+w*0.5} ${y-12} ${x+w*0.7} ${y}`} fill="none" stroke={colors.stroke} strokeWidth={2.5}/>);
    } else if (type === 'mesa') {
      const legH = Math.min(18, h * 0.25);
      els.push(<line key="l1" x1={x+10} y1={y+h} x2={x+10} y2={y+h+legH} stroke={colors.stroke} strokeWidth={3} strokeLinecap="round"/>);
      els.push(<line key="l2" x1={x+w-10} y1={y+h} x2={x+w-10} y2={y+h+legH} stroke={colors.stroke} strokeWidth={3} strokeLinecap="round"/>);
      if (w > 100) {
        els.push(<line key="l3" x1={x+w*0.35} y1={y+h} x2={x+w*0.35} y2={y+h+legH} stroke={colors.stroke} strokeWidth={3} strokeLinecap="round"/>);
        els.push(<line key="l4" x1={x+w*0.65} y1={y+h} x2={x+w*0.65} y2={y+h+legH} stroke={colors.stroke} strokeWidth={3} strokeLinecap="round"/>);
      }
    } else if (type === 'repisa') {
      els.push(<path key="b1" d={`M${x+4} ${y+h}L${x-6} ${y+h+12}`} stroke={colors.stroke} strokeWidth={2.5} strokeLinecap="round"/>);
      els.push(<path key="b2" d={`M${x+w-4} ${y+h}L${x+w+6} ${y+h+12}`} stroke={colors.stroke} strokeWidth={2.5} strokeLinecap="round"/>);
      for (let i = 1; i < drawers; i++) {
        const ly = y + (h / drawers) * i;
        els.push(<line key={`rl${i}`} x1={x+4} y1={ly} x2={x+w-4} y2={ly} stroke={colors.stroke} strokeWidth={1} opacity={0.4}/>);
      }
    } else if (type === 'organizador') {
      const cols = Math.min(drawers, Math.ceil(Math.sqrt(drawers)));
      const rows = Math.ceil(drawers / cols);
      for (let r = 1; r < rows; r++) els.push(<line key={`gr${r}`} x1={x+3} y1={y+(h/rows)*r} x2={x+w-3} y2={y+(h/rows)*r} stroke={colors.stroke} strokeWidth={0.8} opacity={0.3}/>);
      for (let cl = 1; cl < cols; cl++) els.push(<line key={`gc${cl}`} x1={x+(w/cols)*cl} y1={y+3} x2={x+(w/cols)*cl} y2={y+h-3} stroke={colors.stroke} strokeWidth={0.8} opacity={0.3}/>);
    }
    return els;
  };

  const renderResizeHandles = (c) => {
    const hs = 10;
    const corners = [
      { cx:c.x,     cy:c.y,     action:'resize-nw', cls:'resize-handle' },
      { cx:c.x+c.w, cy:c.y,     action:'resize-ne', cls:'resize-handle-ne' },
      { cx:c.x,     cy:c.y+c.h, action:'resize-sw', cls:'resize-handle-sw' },
      { cx:c.x+c.w, cy:c.y+c.h, action:'resize-se', cls:'resize-handle' },
    ];
    return corners.map(({ cx, cy, action, cls }) => (
      <rect key={action} x={cx-hs/2} y={cy-hs/2} width={hs} height={hs} rx={2}
        fill="white" stroke="#345b82" strokeWidth={2} className={cls}
        onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, c.id, action); }} />
    ));
  };

  const sorted = useMemo(() => {
    const byZ = [...containers].sort((a, b) => (a.z || 0) - (b.z || 0));
    if (!selectedId) return byZ;
    return [...byZ.filter(c => c.id !== selectedId), ...byZ.filter(c => c.id === selectedId)];
  }, [containers, selectedId]);

  // Rota el mueble seleccionado en pasos de 90°
  const rotateSelected = () => {
    if (!selectedId) return;
    const c = containers.find(c => c.id === selectedId);
    if (!c) return;
    const rotation = ((c.rotation || 0) + 90) % 360;
    onUpdateContainer(selectedId, { rotation });
    if (onCommitContainer) onCommitContainer({ ...c, rotation });
  };

  const restack = (dir) => {
    if (!selectedId) return;
    const z = dir === 'front'
      ? containers.reduce((m, c) => Math.max(m, c.z || 0), 0) + 1
      : containers.reduce((m, c) => Math.min(m, c.z || 0), 0) - 1;
    onUpdateContainer(selectedId, { z });
    const c = containers.find(c => c.id === selectedId);
    if (c && onCommitContainer) onCommitContainer({ ...c, z });
  };

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-100 text-steel-700"><Icon name="map" size={22}/></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Mapa del Taller</h3>
            <p className="text-xs text-ink-mute">{editMode ? 'Modo edicion: arrastra muebles y la entrada (Acceso)' : 'Toca un mueble para abrirlo'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setVisMenu(v => !v)} title="Elegir qué etiquetas mostrar en el mapa"
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-sm font-semibold shadow-soft transition active:scale-95 ${Object.values(vis).every(Boolean) ? 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50' : 'border-steel-300 bg-steel-100 text-steel-700'}`}>
              <Icon name="eye" size={15}/> <span className="hidden lg:inline">Ver</span> <Icon name="chevron-down" size={12}/>
            </button>
            {visMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setVisMenu(false)}/>
                <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border border-steel-200 bg-white p-1.5 shadow-lift">
                  {VIS_OPTIONS.map(o => (
                    <button key={o.key} onClick={() => toggleVis(o.key)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink-soft transition hover:bg-steel-50">
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${vis[o.key] ? 'border-steel-600 bg-steel-600 text-white' : 'border-steel-300 bg-white'}`}>
                        {vis[o.key] && <Icon name="check" size={13}/>}
                      </span>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {editMode && (
            <>
              <button onClick={onAddFurniture} className="flex items-center gap-1.5 rounded-xl bg-sage-500 px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-600 active:scale-95">
                <Icon name="plus" size={16}/> Mueble
              </button>
              {selectedId && (
                <>
                  <button onClick={rotateSelected} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-2.5 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50 active:scale-95" title="Rotar 90°">
                    <Icon name="rotate-cw" size={15}/> <span className="hidden lg:inline">Rotar</span>
                  </button>
                  <button onClick={() => restack('front')} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-2.5 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50 active:scale-95" title="Traer al frente">
                    <Icon name="arrow-up-to-line" size={15}/> <span className="hidden lg:inline">Frente</span>
                  </button>
                  <button onClick={() => restack('back')} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-2.5 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50 active:scale-95" title="Enviar atras">
                    <Icon name="arrow-down-to-line" size={15}/> <span className="hidden lg:inline">Atras</span>
                  </button>
                  <button onClick={() => onEditFurniture(containers.find(c => c.id === selectedId))} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-700 shadow-soft transition hover:bg-steel-50 active:scale-95">
                    <Icon name="pencil" size={15}/> Editar
                  </button>
                  <button onClick={() => { onDeleteContainer(selectedId); setSelectedId(null); }} className="flex items-center gap-1.5 rounded-xl border border-clay-200 bg-white px-2.5 py-2 text-sm font-semibold text-clay-600 shadow-soft transition hover:bg-clay-50 active:scale-95">
                    <Icon name="trash-2" size={15}/>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-steel-200 bg-steel-50/40">
        <svg ref={svgRef} viewBox="0 0 1000 600" className="map-svg w-full"
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="#c8d8e8" strokeWidth="0.5" opacity={editMode ? 0.7 : 0.4}/>
            </pattern>
          </defs>

          <rect x="20" y="20" width="960" height="560" fill="url(#grid)" />
          <rect x="20" y="20" width="960" height="560" fill="none" stroke="#345b82" strokeWidth="4" rx="6" />
          <rect x="20" y="20" width="960" height="560" fill="transparent" onClick={() => editMode && setSelectedId(null)} />
          <Entrance entrance={entranceDrag || entrance} editMode={editMode} dragging={!!entranceDrag}
            onPointerDown={e => { if (!editMode) return; e.preventDefault(); e.stopPropagation(); setEntranceDrag(entranceDrag || entrance); }}/>

          {sorted.map(c => {
            const meta = CONTAINER_META[c.type];
            if (!meta) return null;
            const colors = FURNITURE_COLORS[meta.accent] || FURNITURE_COLORS.steel;
            const st = stats[c.id] || { count:0, missing:0 };
            const isSel = selectedId === c.id;
            return (
              <g key={c.id} className="furniture-group"
                style={{ cursor: editMode ? (drag ? 'grabbing' : 'grab') : 'pointer' }}
                onClick={e => handleClick(e, c)}
                onPointerDown={e => handlePointerDown(e, c.id, 'move')}>
                {isSel && editMode && <rect x={c.x-3} y={c.y-3} width={c.w+6} height={c.h+6} rx={11} fill="none" stroke="#345b82" strokeWidth={2} strokeDasharray="6 3" opacity={0.6}/>}
                <g transform={c.rotation ? `rotate(${c.rotation} ${c.x + c.w/2} ${c.y + c.h/2})` : undefined}>
                  {renderShape(c, colors)}
                  {renderDecoration(c, colors)}
                </g>
                {vis.names && <text x={c.x + c.w/2} y={c.y - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill="#27272a" style={{pointerEvents:'none'}}>{c.name}</text>}
                {vis.counts && <text x={c.x + c.w/2} y={c.y + c.h + 18} textAnchor="middle" fontSize={11} fill="#71717a" style={{pointerEvents:'none'}}>{st.count} herr.</text>}
                {vis.badges && st.missing > 0 && (
                  <g style={{pointerEvents:'none'}}>
                    <circle cx={c.x + c.w - 10} cy={c.y + 10} r={11} fill="#f59e0b"/>
                    <text x={c.x + c.w - 10} y={c.y + 14.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{st.missing}</text>
                  </g>
                )}
                {editMode && isSel && renderResizeHandles(c)}
              </g>
            );
          })}

          <g transform="translate(940, 60)" style={{pointerEvents:'none'}}>
            <circle r="18" fill="#fff" stroke="#c8d8e8" strokeWidth="1.5"/>
            <path d="M0 -12 L5 4 L0 0 L-5 4 Z" fill="#bc602c"/>
            <text x="0" y="-22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#345b82">N</text>
          </g>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-mute">
        {Object.entries(CONTAINER_META).map(([key, meta]) => {
          const colors = FURNITURE_COLORS[meta.accent];
          return <span key={key} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{background:colors.fill, boxShadow:`inset 0 0 0 1px ${colors.stroke}`}}/> {meta.label}</span>;
        })}
        <span className="flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white">!</span> Items fuera</span>
      </div>
    </div>
  );
}
