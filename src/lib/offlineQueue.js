// Cola offline: las mutaciones que fallan (sin internet / sin sesión) se
// guardan en localStorage y se reintentan al reconectar.
const QUEUE_KEY = 'taller_cola_offline';

export function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* quota */ }
}

export function enqueue(op, payload) {
  const q = loadQueue();
  q.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2,6), op, payload, ts: new Date().toISOString() });
  saveQueue(q);
  notify();
}

export function queueSize() { return loadQueue().length; }

// executors: { opName: async (payload) => void } — lanzan si fallan
export async function flushQueue(executors) {
  let q = loadQueue();
  if (q.length === 0) return 0;
  let flushed = 0;
  for (const item of [...q]) {
    const exec = executors[item.op];
    if (!exec) { q = q.filter(x => x.id !== item.id); continue; } // op desconocida: descartar
    try {
      await exec(item.payload);
      q = q.filter(x => x.id !== item.id);
      flushed++;
    } catch {
      break; // sigue sin conexión: parar y reintentar después
    }
  }
  saveQueue(q);
  notify();
  return flushed;
}

// suscripción simple para mostrar el tamaño de la cola en la UI
const listeners = new Set();
export function onQueueChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { const n = queueSize(); listeners.forEach(fn => fn(n)); }
