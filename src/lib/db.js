import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
import { enqueue, flushQueue } from './offlineQueue';

export const sb = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ── Taller (equipo) activo ──
   Se fija al iniciar sesión a partir de la clave maestra con la que se
   registró el usuario. Toda fila se etiqueta y toda consulta se filtra
   por este valor; las políticas RLS lo refuerzan en el servidor. */
let currentTeam = null;
export const setDbTeam = (team) => { currentTeam = team || null; };
const byTeam = (q) => currentTeam ? q.eq('team', currentTeam) : q;

/* ── Mappers fila <-> modelo ── */
export const toolToRow = (t) => ({
  id:t.id, name:t.name, category:t.category, serial:t.serial||'',
  total:t.total, current_qty:t.current, container_id:t.container,
  drawer:t.drawer, icon:t.icon||'', icon_url:t.iconUrl||'', icon_label:t.iconLabel||'',
  min_stock:t.minStock||0, status:t.status||'ok', deleted_at:t.deletedAt||null,
  team:currentTeam,
});
export const rowToTool = (r) => ({
  id:r.id, name:r.name, category:r.category, serial:r.serial||'',
  total:r.total, current:r.current_qty, container:r.container_id,
  drawer:r.drawer, icon:r.icon||'', iconUrl:r.icon_url||'', iconLabel:r.icon_label||'',
  minStock:r.min_stock||0, status:r.status||'ok', deletedAt:r.deleted_at||null,
});
export const containerToRow = (c) => ({
  id:c.id, type:c.type, name:c.name, drawers:c.drawers,
  drawer_names:c.drawerNames||[], x:c.x, y:c.y, w:c.w, h:c.h, z:c.z||0, shape:c.shape||'rect',
  team:currentTeam,
});
export const rowToContainer = (r) => ({
  id:r.id, type:r.type, name:r.name, drawers:r.drawers,
  drawerNames:r.drawer_names||[], x:r.x, y:r.y, w:r.w, h:r.h, z:r.z||0, shape:r.shape||'rect',
});
export const iconToRow = (i) => ({ id:i.id, url:i.url, label:i.label||'', team:currentTeam });
export const rowToIcon = (r) => ({ id:r.id, url:r.url, label:r.label||'' });
export const txToRow = (t) => ({
  id:t.id, tool_id:t.toolId, tool_name:t.toolName, type:t.type, qty:t.qty,
  person:t.person||'', note:t.note||'', ts:t.ts,
  team:currentTeam,
});
export const rowToTx = (r) => ({
  id:r.id, toolId:r.tool_id, toolName:r.tool_name, type:r.type, qty:r.qty,
  person:r.person||'', note:r.note||'', ts:r.ts,
});
export const kitToRow = (k) => ({ id:k.id, name:k.name, description:k.description||'', items:k.items||[], team:currentTeam });
export const rowToKit = (r) => ({ id:r.id, name:r.name, description:r.description||'', items:r.items||[] });

/* ── Operaciones ── */
export async function dbFetchAll() {
  if (!sb) return null;
  try {
    const [cRes, tRes, iRes, txRes, kRes] = await Promise.all([
      byTeam(sb.from('containers').select('*')),
      byTeam(sb.from('tools').select('*')),
      byTeam(sb.from('custom_icons').select('*')),
      byTeam(sb.from('transactions').select('*')).order('ts', { ascending:false }).limit(500),
      byTeam(sb.from('kits').select('*')),
    ]);
    if (cRes.error || tRes.error) return null;
    return {
      containers: (cRes.data || []).map(rowToContainer),
      tools: (tRes.data || []).map(rowToTool),
      customIcons: (iRes.data || []).map(rowToIcon),
      transactions: (txRes.data || []).map(rowToTx),
      kits: (kRes.data || []).map(rowToKit),
    };
  } catch { return null; }
}

/* ── Mutaciones con cola offline ──
   Si la operación falla (sin internet, sin sesión), se encola y se
   reintenta automáticamente al reconectar. */
const throwOnError = ({ error }) => { if (error) throw error; };

const EXECUTORS = {
  upsertContainer: (row) => sb.from('containers').upsert(row).then(throwOnError),
  upsertTool:      (row) => sb.from('tools').upsert(row).then(throwOnError),
  hardDeleteTool:  (id)  => sb.from('tools').delete().eq('id', id).then(throwOnError),
  upsertIcon:      (row) => sb.from('custom_icons').upsert(row).then(throwOnError),
  insertTx:        (row) => sb.from('transactions').insert(row).then(throwOnError),
  upsertKit:       (row) => sb.from('kits').upsert(row).then(throwOnError),
  deleteKit:       (id)  => sb.from('kits').delete().eq('id', id).then(throwOnError),
  adjustTool:      async ({ row, delta }) => {
    const { error } = await sb.rpc('adjust_tool_qty', { p_tool_id: row.id, p_delta: delta });
    if (error) await sb.from('tools').upsert(row).then(throwOnError); // fallback no atómico
  },
  deleteContainer: async (id) => {
    await sb.from('tools').delete().eq('container_id', id).then(throwOnError);
    await sb.from('containers').delete().eq('id', id).then(throwOnError);
  },
};

async function run(op, payload) {
  if (!sb) return;
  try { await EXECUTORS[op](payload); }
  catch { enqueue(op, payload); }
}

export const dbUpsertContainer = (c) => run('upsertContainer', containerToRow(c));
export const dbUpsertTool = (t) => run('upsertTool', toolToRow(t));
export const dbHardDeleteTool = (id) => run('hardDeleteTool', id);
export const dbUpsertIcon = (ic) => run('upsertIcon', iconToRow(ic));
export const dbInsertTx = (tx) => run('insertTx', txToRow(tx));
export const dbUpsertKit = (k) => run('upsertKit', kitToRow(k));
export const dbDeleteKit = (id) => run('deleteKit', id);
export const dbDeleteContainer = (id) => run('deleteContainer', id);
export const dbAdjustTool = (tool, delta) => run('adjustTool', { row: toolToRow(tool), delta });

// Reintenta todo lo pendiente (se llama al reconectar / iniciar sesión)
export const dbFlushQueue = () => sb ? flushQueue(EXECUTORS) : Promise.resolve(0);

/* ── Auth ── */
export const authSignIn = (email, password) => sb.auth.signInWithPassword({ email, password });
export const authSignUp = (email, password, metadata = {}) => sb.auth.signUp({ email, password, options: { data: metadata } });
export const authSignOut = () => sb.auth.signOut();
export const authGetSession = () => sb?.auth.getSession();
export const authOnChange = (cb) => sb?.auth.onAuthStateChange(cb);

// Sembrar la DB SOLO si está realmente vacía (para el taller activo)
export async function dbSeedFromLocal(state) {
  if (!sb) return;
  const existing = await byTeam(sb.from('containers').select('id', { count:'exact', head:true }));
  if (existing.error || (existing.count ?? 0) > 0) return;
  if (state.containers.length) await sb.from('containers').upsert(state.containers.map(containerToRow));
  if (state.tools.length) await sb.from('tools').upsert(state.tools.map(toolToRow));
  if ((state.customIcons||[]).length) await sb.from('custom_icons').upsert(state.customIcons.map(iconToRow));
}
