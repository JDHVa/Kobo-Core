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
  photo_url:t.photo||'',
  team:currentTeam,
});
export const rowToTool = (r) => ({
  id:r.id, name:r.name, category:r.category, serial:r.serial||'',
  total:r.total, current:r.current_qty, container:r.container_id,
  drawer:r.drawer, icon:r.icon||'', iconUrl:r.icon_url||'', iconLabel:r.icon_label||'',
  minStock:r.min_stock||0, status:r.status||'ok', deletedAt:r.deleted_at||null,
  photo:r.photo_url||'',
});
export const containerToRow = (c) => ({
  id:c.id, type:c.type, name:c.name, drawers:c.drawers,
  drawer_names:c.drawerNames||[], x:c.x, y:c.y, w:c.w, h:c.h, z:c.z||0, shape:c.shape||'rect',
  rotation:c.rotation||0,
  team:currentTeam,
});
export const rowToContainer = (r) => ({
  id:r.id, type:r.type, name:r.name, drawers:r.drawers,
  drawerNames:r.drawer_names||[], x:r.x, y:r.y, w:r.w, h:r.h, z:r.z||0, shape:r.shape||'rect',
  rotation:r.rotation||0,
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
export const wishToRow = (w) => ({
  id:w.id, name:w.name, price:w.price ?? null, qty:w.qty||1, url:w.url||'',
  photo_url:w.photo||'', note:w.note||'', team:currentTeam,
});
export const rowToWish = (r) => ({
  id:r.id, name:r.name, price:r.price ?? null, qty:r.qty||1, url:r.url||'',
  photo:r.photo_url||'', note:r.note||'', createdAt:r.created_at,
});

/* ── Operaciones ── */
export async function dbFetchAll() {
  if (!sb) return null;
  try {
    const [cRes, tRes, iRes, txRes, kRes, wRes] = await Promise.all([
      byTeam(sb.from('containers').select('*')),
      byTeam(sb.from('tools').select('*')),
      byTeam(sb.from('custom_icons').select('*')),
      byTeam(sb.from('transactions').select('*')).order('ts', { ascending:false }).limit(500),
      byTeam(sb.from('kits').select('*')),
      byTeam(sb.from('wishlist').select('*')), // puede fallar si la tabla no existe aún
    ]);
    if (cRes.error || tRes.error) return null;
    return {
      containers: (cRes.data || []).map(rowToContainer),
      tools: (tRes.data || []).map(rowToTool),
      customIcons: (iRes.data || []).map(rowToIcon),
      transactions: (txRes.data || []).map(rowToTx),
      kits: (kRes.data || []).map(rowToKit),
      wishlist: (wRes.data || []).map(rowToWish),
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
  upsertWish:      (row) => sb.from('wishlist').upsert(row).then(throwOnError),
  deleteWish:      (id)  => sb.from('wishlist').delete().eq('id', id).then(throwOnError),
  upsertMapSettings: (row) => sb.from('map_settings').upsert(row).then(throwOnError),
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
export const dbUpsertWish = (w) => run('upsertWish', wishToRow(w));
export const dbDeleteWish = (id) => run('deleteWish', id);
export const dbSaveMapSettings = (entrance) =>
  run('upsertMapSettings', { team: currentTeam, entrance, updated_at: new Date().toISOString() });

export async function dbFetchMapSettings() {
  if (!sb || !currentTeam) return null;
  try {
    const { data } = await sb.from('map_settings').select('entrance').eq('team', currentTeam).maybeSingle();
    return data?.entrance || null;
  } catch { return null; }
}

/* ── Fotos (Supabase Storage, bucket "fotos") ──
   Redimensiona en el navegador antes de subir para no llenar el bucket. */
async function compressImage(file, maxSize = 1000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
}

export async function dbUploadPhoto(file) {
  if (!sb) throw new Error('Sin conexión a la base de datos');
  const blob = await compressImage(file).catch(() => file); // si falla la compresión, sube el original
  const path = `${currentTeam || 'comun'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
}

// Reintenta todo lo pendiente (se llama al reconectar / iniciar sesión)
export const dbFlushQueue = () => sb ? flushQueue(EXECUTORS) : Promise.resolve(0);

/* ── Perfiles y roles ── */
export async function dbFetchProfile(userId) {
  if (!sb || !userId) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}
export async function dbFetchTeamMembers() {
  if (!sb) return [];
  const { data } = await byTeam(sb.from('profiles').select('*')).order('created_at');
  return data || [];
}
export const dbSetMemberRole = (userId, role) =>
  sb ? sb.from('profiles').update({ role }).eq('id', userId) : Promise.resolve({ error: new Error('Sin conexión') });

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
