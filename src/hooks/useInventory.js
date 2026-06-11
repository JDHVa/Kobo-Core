import { useState, useEffect, useCallback } from 'react';
import { loadState, saveState, saveRecentPerson, setStorageTeam } from '../lib/storage';
import { uid, clamp } from '../lib/utils';
import {
  sb, dbFetchAll, dbSeedFromLocal, dbUpsertContainer, dbUpsertTool, dbHardDeleteTool,
  dbDeleteContainer, dbUpsertIcon, dbInsertTx, dbUpsertKit, dbDeleteKit, dbAdjustTool,
  dbFlushQueue, authGetSession, authOnChange, setDbTeam,
  rowToContainer, rowToTool, rowToIcon, rowToTx, rowToKit,
} from '../lib/db';
import { queueSize, onQueueChange } from '../lib/offlineQueue';

// upsert genérico inmutable por id
const mergeById = (list, item) =>
  list.some(x => x.id === item.id) ? list.map(x => x.id === item.id ? item : x) : [...list, item];

export function useInventory() {
  const [state, setState] = useState(loadState);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbLoading, setDbLoading] = useState(!!sb);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!sb);
  const [pendingOps, setPendingOps] = useState(queueSize());

  useEffect(() => { saveState(state); }, [state]);

  // Sesión de auth
  useEffect(() => {
    if (!sb) return;
    authGetSession()?.then(({ data }) => { setSession(data?.session || null); setAuthReady(true); });
    const { data: sub } = authOnChange((_event, s) => setSession(s)) || {};
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // Cola offline: contador en UI + reintento al reconectar
  useEffect(() => {
    const off = onQueueChange(setPendingOps);
    const flush = () => dbFlushQueue();
    window.addEventListener('online', flush);
    const interval = setInterval(flush, 30000);
    return () => { off(); window.removeEventListener('online', flush); clearInterval(interval); };
  }, []);

  // Taller del usuario: viene de la clave maestra usada al registrarse.
  // app_metadata (no editable por el usuario) tiene prioridad sobre user_metadata.
  const team = session?.user?.app_metadata?.team || session?.user?.user_metadata?.team || null;

  // Carga inicial + seed seguro (requiere sesión por RLS)
  useEffect(() => {
    if (!sb || !session) return; // sin sb, dbLoading ya inicia en false
    setStorageTeam(team);
    setDbTeam(team);
    (async () => {
      setDbLoading(true);
      const local = loadState(); // caché propio del taller (vacío si es nuevo)
      setState(local);
      await dbFlushQueue(); // primero lo pendiente, para no pisarlo con el fetch
      await dbSeedFromLocal(local);
      const remote = await dbFetchAll();
      if (remote) { setState(remote); setDbConnected(true); }
      setDbLoading(false);
    })();
  }, [session?.user?.id]);

  // Realtime
  useEffect(() => {
    if (!sb || !session) return;
    const apply = (key, mapper) => (p) => {
      // Ignorar eventos de otros talleres (RLS ya los bloquea; esto es refuerzo).
      if (p.eventType !== 'DELETE' && team && p.new?.team && p.new.team !== team) return;
      setState(prev => {
        const list = prev[key] || [];
        if (p.eventType === 'DELETE') return { ...prev, [key]: list.filter(x => x.id !== p.old.id) };
        return { ...prev, [key]: mergeById(list, mapper(p.new)) };
      });
    };
    const channel = sb.channel(`inventory-sync:${team || 'default'}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'containers' }, apply('containers', rowToContainer))
      .on('postgres_changes', { event:'*', schema:'public', table:'tools' }, apply('tools', rowToTool))
      .on('postgres_changes', { event:'*', schema:'public', table:'custom_icons' }, apply('customIcons', rowToIcon))
      .on('postgres_changes', { event:'*', schema:'public', table:'transactions' }, apply('transactions', rowToTx))
      .on('postgres_changes', { event:'*', schema:'public', table:'kits' }, apply('kits', rowToKit))
      .subscribe((status) => setDbConnected(status === 'SUBSCRIBED'));
    return () => { sb.removeChannel(channel); };
  }, [session?.user?.id]);

  /* ── Movimientos con trazabilidad ── */
  const recordMovement = useCallback(({ toolId, type, qty, person = '', note = '' }) => {
    setState(prev => {
      const tool = prev.tools.find(t => t.id === toolId);
      if (!tool) return prev;
      const delta = type === 'retiro' ? -qty : qty;
      const updated = { ...tool, current: clamp(tool.current + delta, 0, tool.total) };
      const tx = { id: uid(), toolId, toolName: tool.name, type, qty, person, note, ts: new Date().toISOString() };
      dbAdjustTool(updated, delta);
      dbInsertTx(tx);
      if (person) saveRecentPerson(person);
      return { ...prev, tools: prev.tools.map(t => t.id === toolId ? updated : t), transactions: [tx, ...prev.transactions] };
    });
  }, []);

  const saveTool = useCallback((tool, { isNew } = {}) => {
    setState(prev => {
      dbUpsertTool(tool);
      let customIcons = prev.customIcons || [];
      if (tool.icon === 'custom' && tool.iconUrl && !customIcons.some(ci => ci.url === tool.iconUrl)) {
        const newIcon = { id: uid(), url: tool.iconUrl, label: tool.iconLabel || tool.name };
        customIcons = [...customIcons, newIcon];
        dbUpsertIcon(newIcon);
      }
      let transactions = prev.transactions;
      if (isNew) {
        const tx = { id: uid(), toolId: tool.id, toolName: tool.name, type:'alta', qty: tool.total, person:'', note:'Registro inicial', ts: new Date().toISOString() };
        dbInsertTx(tx);
        transactions = [tx, ...transactions];
      }
      return { ...prev, tools: mergeById(prev.tools, tool), customIcons, transactions };
    });
  }, []);

  // Soft-delete: marca deletedAt; la herramienta va a la papelera (restaurable)
  const deleteTool = useCallback((tool) => {
    const updated = { ...tool, deletedAt: new Date().toISOString() };
    dbUpsertTool(updated);
    const tx = { id: uid(), toolId: tool.id, toolName: tool.name, type:'baja', qty: tool.total, person:'', note:'Enviada a la papelera', ts: new Date().toISOString() };
    dbInsertTx(tx);
    setState(prev => ({ ...prev, tools: prev.tools.map(t => t.id === tool.id ? updated : t), transactions: [tx, ...prev.transactions] }));
  }, []);

  const restoreTool = useCallback((tool) => {
    const updated = { ...tool, deletedAt: null };
    dbUpsertTool(updated);
    const tx = { id: uid(), toolId: tool.id, toolName: tool.name, type:'alta', qty: 0, person:'', note:'Restaurada de la papelera', ts: new Date().toISOString() };
    dbInsertTx(tx);
    setState(prev => ({ ...prev, tools: prev.tools.map(t => t.id === tool.id ? updated : t), transactions: [tx, ...prev.transactions] }));
  }, []);

  const purgeTool = useCallback((tool) => {
    dbHardDeleteTool(tool.id);
    setState(prev => ({ ...prev, tools: prev.tools.filter(t => t.id !== tool.id) }));
  }, []);

  // Registro de auditoría completada (para el calendario de conteo cíclico)
  const recordAudit = useCallback((container, person, adjustments) => {
    const tx = { id: uid(), toolId: container.id, toolName: container.name, type:'auditoria', qty: adjustments, person: person||'',
      note: adjustments > 0 ? `Conteo cíclico: ${adjustments} ajuste(s)` : 'Conteo cíclico: sin discrepancias', ts: new Date().toISOString() };
    dbInsertTx(tx);
    setState(prev => ({ ...prev, transactions: [tx, ...prev.transactions] }));
  }, []);

  const setToolStatus = useCallback((toolId, status, note = '') => {
    setState(prev => {
      const tool = prev.tools.find(t => t.id === toolId);
      if (!tool) return prev;
      const updated = { ...tool, status };
      dbUpsertTool(updated);
      const tx = { id: uid(), toolId, toolName: tool.name, type:'estado', qty:0, person:'', note: note || `Estado: ${status}`, ts: new Date().toISOString() };
      dbInsertTx(tx);
      return { ...prev, tools: prev.tools.map(t => t.id === toolId ? updated : t), transactions: [tx, ...prev.transactions] };
    });
  }, []);

  // Ajuste por conteo cíclico: fija current al valor contado
  const applyCount = useCallback((toolId, counted, person) => {
    setState(prev => {
      const tool = prev.tools.find(t => t.id === toolId);
      if (!tool || tool.current === counted) return prev;
      const updated = { ...tool, current: clamp(counted, 0, tool.total) };
      dbUpsertTool(updated);
      const tx = { id: uid(), toolId, toolName: tool.name, type:'ajuste', qty: Math.abs(counted - tool.current), person: person||'',
        note:`Conteo cíclico: ${tool.current} → ${counted}`, ts: new Date().toISOString() };
      dbInsertTx(tx);
      return { ...prev, tools: prev.tools.map(t => t.id === toolId ? updated : t), transactions: [tx, ...prev.transactions] };
    });
  }, []);

  /* ── Muebles ── */
  const updateContainer = useCallback((id, upd) => {
    setState(prev => ({ ...prev, containers: prev.containers.map(c => c.id === id ? { ...c, ...upd } : c) }));
  }, []);
  const commitContainer = useCallback((c) => { dbUpsertContainer(c); }, []);
  const saveContainer = useCallback((furniture) => {
    dbUpsertContainer(furniture);
    setState(prev => ({ ...prev, containers: mergeById(prev.containers, furniture) }));
  }, []);
  const removeContainer = useCallback((id, removeTools) => {
    dbDeleteContainer(id);
    setState(prev => ({
      ...prev,
      containers: prev.containers.filter(c => c.id !== id),
      tools: removeTools ? prev.tools.filter(t => t.container !== id) : prev.tools,
    }));
  }, []);

  const saveDrawers = useCallback((containerId, newNames, orderMap, newCount) => {
    setState(prev => {
      const containers = prev.containers.map(c => {
        if (c.id !== containerId) return c;
        const updated = { ...c, drawers: newCount, drawerNames: newNames };
        dbUpsertContainer(updated);
        return updated;
      });
      let tools = prev.tools;
      if (orderMap) {
        const invMap = {};
        orderMap.forEach((origIdx, newIdx) => { if (origIdx >= 0) invMap[origIdx] = newIdx; });
        tools = prev.tools.map(t => {
          if (t.container !== containerId) return t;
          const updated = invMap[t.drawer] !== undefined ? { ...t, drawer: invMap[t.drawer] } : { ...t, drawer: 0 };
          if (updated.drawer !== t.drawer) dbUpsertTool(updated);
          return updated;
        });
      }
      return { ...prev, containers, tools };
    });
  }, []);

  /* ── Kits ── */
  const saveKit = useCallback((kit) => {
    dbUpsertKit(kit);
    setState(prev => ({ ...prev, kits: mergeById(prev.kits || [], kit) }));
  }, []);
  const deleteKit = useCallback((id) => {
    dbDeleteKit(id);
    setState(prev => ({ ...prev, kits: (prev.kits || []).filter(k => k.id !== id) }));
  }, []);

  /* ── Import / Export ── */
  const importState = useCallback((imported) => {
    setState(imported);
    if (sb) {
      imported.containers.forEach(c => dbUpsertContainer(c));
      imported.tools.forEach(t => dbUpsertTool(t));
      (imported.customIcons || []).forEach(ic => dbUpsertIcon(ic));
      (imported.kits || []).forEach(k => dbUpsertKit(k));
    }
  }, []);

  return {
    state, dbConnected, dbLoading, session, authReady, pendingOps,
    recordMovement, saveTool, deleteTool, restoreTool, purgeTool, recordAudit, setToolStatus, applyCount,
    updateContainer, commitContainer, saveContainer, removeContainer, saveDrawers,
    saveKit, deleteKit, importState,
  };
}
