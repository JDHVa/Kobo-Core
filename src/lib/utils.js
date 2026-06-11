export function statusOf(tool) {
  const missing = tool.total - tool.current;
  const pct = tool.total > 0 ? Math.round((tool.current / tool.total) * 100) : 0;
  if (tool.current <= 0) return { key:'empty', missing, pct };
  if (missing > 0) return { key:'partial', missing, pct };
  return { key:'full', missing:0, pct };
}

export const uid = () => 'id-' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-3);
export const snap = (v, g=20) => Math.round(v / g) * g;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const fmtDate = (ts) => new Date(ts).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

// ¿Está por debajo del stock mínimo? (reorder point)
export const belowMin = (tool) => (tool.minStock || 0) > 0 && tool.current < tool.minStock;
