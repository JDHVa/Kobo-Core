import { DEFAULT_CONTAINERS, SEED_TOOLS } from '../constants';

const STORAGE_KEY = 'taller_inventario_v3';
const LEGACY_KEYS = ['taller_inventario_v2', 'taller_inventario_v1'];
const PEOPLE_KEY = 'taller_personas_recientes';

// Caché local separado por taller: cada equipo guarda bajo su propia clave.
// Sin sesión (o cuentas antiguas sin equipo) se usa la clave compartida.
let currentTeam = null;
export function setStorageTeam(team) { currentTeam = team || null; }
const activeKey = () => currentTeam ? `${STORAGE_KEY}:${currentTeam}` : STORAGE_KEY;

const emptyState = () => ({ containers: [], tools: [], customIcons: [], transactions: [], kits: [] });

export function migrateContainers(containers) {
  return containers.map(c => {
    const names = Array.isArray(c.drawerNames) ? c.drawerNames.slice(0, c.drawers) : [];
    while (names.length < c.drawers) names.push('');
    return {
      ...c, drawerNames: names,
      x: c.x ?? 100, y: c.y ?? 100, w: c.w ?? 170, h: c.h ?? 120,
      z: c.z ?? 0, shape: c.shape || 'rect',
    };
  });
}

export function migrateTools(tools) {
  return tools.map(t => ({
    ...t,
    icon: t.icon || '', iconUrl: t.iconUrl || '',
    minStock: t.minStock ?? 0,
    status: t.status || 'ok',
    deletedAt: t.deletedAt ?? null,
  }));
}

export function loadState() {
  try {
    let raw = localStorage.getItem(activeKey());
    // El fallback a claves antiguas solo aplica al caché compartido:
    // un taller nuevo no debe heredar datos de otro taller en este equipo.
    if (!raw && !currentTeam) { for (const k of LEGACY_KEYS) { if (!raw) raw = localStorage.getItem(k); } }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tools) && Array.isArray(parsed.containers)) {
        return {
          containers: migrateContainers(parsed.containers),
          tools: migrateTools(parsed.tools),
          customIcons: Array.isArray(parsed.customIcons) ? parsed.customIcons : [],
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          kits: Array.isArray(parsed.kits) ? parsed.kits : [],
        };
      }
    }
  } catch { /* corrupted storage -> seed */ }
  // Taller con sesión y sin caché: empieza vacío (sus datos reales vienen de la DB).
  if (currentTeam) return emptyState();
  return { containers: DEFAULT_CONTAINERS, tools: migrateTools(SEED_TOOLS), customIcons: [], transactions: [], kits: [] };
}

export function saveState(state) {
  try { localStorage.setItem(activeKey(), JSON.stringify(state)); } catch { /* quota */ }
}

// Autocompletado de personas recientes para el check-out
export function loadRecentPeople() {
  try { return JSON.parse(localStorage.getItem(PEOPLE_KEY)) || []; } catch { return []; }
}
export function saveRecentPerson(name) {
  if (!name) return;
  const list = [name, ...loadRecentPeople().filter(p => p.toLowerCase() !== name.toLowerCase())].slice(0, 12);
  try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(list)); } catch { /* quota */ }
}
