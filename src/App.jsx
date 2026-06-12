import { useState, useMemo, useRef, useEffect } from 'react';
import { useInventory } from './hooks/useInventory';
import { Icon, MetricCard, EmptyState, Toast, ConfirmDialog } from './components/ui';
import { ToolCard } from './components/ToolCard';
import { InteractiveMap } from './components/InteractiveMap';
import { StorageContainer, ContainerView, DrawerView } from './components/views';
import { ToolModal } from './components/modals/ToolModal';
import { FurnitureModal } from './components/modals/FurnitureModal';
import { DrawerEditorModal } from './components/modals/DrawerEditorModal';
import { CheckoutModal } from './components/modals/CheckoutModal';
import { HistoryView } from './features/HistoryView';
import { ReorderPanel } from './features/ReorderPanel';
import { KitsView } from './features/KitsView';
import { CycleCountView } from './features/CycleCountView';
import { WishlistView } from './features/WishlistView';
import { TableView } from './features/TableView';
import { QrSheet } from './features/QrSheet';
import { AuthGate } from './features/AuthGate';
import { TeamPanel } from './features/TeamPanel';
import { ChatPanel } from './features/ChatPanel';
import { CATEGORIES, getDrawerLabel } from './constants';
import { migrateContainers, migrateTools } from './lib/storage';
import { computeOpenLoans, loansByTool } from './lib/loans';
import { belowMin } from './lib/utils';
import { sb, authSignOut } from './lib/db';

const TABS = [
  { key:'taller',   label:'Taller',       icon:'wrench' },
  { key:'tabla',    label:'Tabla',        icon:'table' },
  { key:'historia', label:'Trazabilidad', icon:'history' },
  { key:'reponer',  label:'Reponer',      icon:'shopping-cart' },
  { key:'deseos',   label:'A futuro',     icon:'sparkles' },
  { key:'kits',     label:'Kits',         icon:'boxes' },
  { key:'auditoria',label:'Auditoría',    icon:'clipboard-check' },
  { key:'qr',       label:'QR',           icon:'qr-code' },
];

export default function App() {
  const inv = useInventory();
  const { containers, tools: allTools, customIcons = [], transactions = [], kits = [], wishlist = [] } = inv.state;
  // Solo herramientas activas (las soft-deleted van a la papelera)
  const tools = useMemo(() => allTools.filter(t => !t.deletedAt), [allTools]);
  const deletedTools = useMemo(() => allTools.filter(t => t.deletedAt), [allTools]);
  // Persona por defecto: el nombre registrado, o la parte local del correo
  const defaultPerson = inv.session?.user?.user_metadata?.display_name
    || inv.session?.user?.email?.split('@')[0] || '';

  const [tab, setTab] = useState('taller');
  const [view, setView] = useState('workshop');
  const [activeContainer, setActiveContainer] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [filterCat, setFilterCat] = useState('Todas');
  const [mapEditMode, setMapEditMode] = useState(false);
  const [furnitureModal, setFurnitureModal] = useState({ open:false, editing:null });
  const [drawerEditor, setDrawerEditor] = useState(null);
  const [confirmFurniture, setConfirmFurniture] = useState(null);
  const [checkout, setCheckout] = useState(null); // { tool, mode }
  const [chatOpen, setChatOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const fileInputRef = useRef(null);

  // SW solo en producción: en dev cachea los módulos y sirve código viejo
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } else {
      // limpiar cualquier SW/caché registrado previamente en localhost
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }, []);

  // QR escaneado: ?tool=ID abre el modal de retiro directo
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tool');
    if (!id || tools.length === 0) return;
    const tool = tools.find(t => t.id === id);
    if (tool) setCheckout({ tool, mode:'retiro' });
    window.history.replaceState({}, '', window.location.pathname); // limpiar la URL
  }, [tools.length]);

  const fireToast = (message, type) => { setToast({ message, type }); setTimeout(() => setToast(null), 2200); };

  // Acciones reservadas al admin (el servidor lo refuerza con RLS)
  const requireAdmin = (fn) => (...args) =>
    inv.isAdmin ? fn(...args) : fireToast('Solo un admin del taller puede hacer esto', 'take');
  // Visitante: solo lectura (el servidor lo refuerza con RLS)
  const requireEdit = (fn) => (...args) =>
    !inv.isVisitor ? fn(...args) : fireToast('Modo visitante: solo puedes ver el taller', 'take');

  const openLoans = useMemo(() => computeOpenLoans(transactions), [transactions]);
  const lowStockCount = useMemo(() => tools.filter(belowMin).length, [tools]);

  /* ── handlers ── */
  const handleCheckoutConfirm = (movement) => {
    inv.recordMovement(movement);
    fireToast(movement.type === 'retiro'
      ? `${movement.person || 'Alguien'} retiró ${movement.qty} unidad${movement.qty>1?'es':''}`
      : `Ingresaste ${movement.qty} unidad${movement.qty>1?'es':''}`, movement.type === 'retiro' ? 'take' : 'add');
  };

  const handleSaveTool = (tool, opts) => {
    inv.saveTool(tool, opts);
    setModalOpen(false); setEditing(null);
    fireToast(opts?.isNew ? 'Herramienta registrada' : 'Herramienta actualizada', 'info');
  };

  const confirmDelete = () => {
    inv.deleteTool(confirm);
    fireToast('Herramienta eliminada', 'info');
    setConfirm(null);
  };

  const handleDeleteContainer = (id) => {
    const c = containers.find(c => c.id === id);
    if (!c) return;
    const toolCount = tools.filter(t => t.container === id).length;
    if (toolCount > 0) setConfirmFurniture({ id, name: c.name, toolCount });
    else { inv.removeContainer(id, false); fireToast('Mueble eliminado', 'info'); }
  };

  const handleSaveDrawers = (...args) => {
    inv.saveDrawers(...args);
    setActiveContainer(prev => {
      if (!prev || prev.id !== args[0]) return prev;
      return { ...prev, drawers: args[3], drawerNames: args[1] };
    });
    setDrawerEditor(null);
    fireToast('Secciones actualizadas', 'info');
  };

  /* ── export / import ── */
  const exportData = () => {
    const blob = new Blob([JSON.stringify(inv.state, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href:url, download:`taller-inventario-${new Date().toISOString().slice(0,10)}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    fireToast('Inventario exportado', 'info');
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data && Array.isArray(data.tools) && Array.isArray(data.containers)) {
          inv.importState({
            containers: migrateContainers(data.containers),
            tools: migrateTools(data.tools),
            customIcons: Array.isArray(data.customIcons) ? data.customIcons : [],
            transactions: Array.isArray(data.transactions) ? data.transactions : [],
            kits: Array.isArray(data.kits) ? data.kits : [],
            wishlist: Array.isArray(data.wishlist) ? data.wishlist : [],
          });
          fireToast('Inventario importado correctamente', 'info');
        } else fireToast('Archivo invalido', 'take');
      } catch { fireToast('Error al leer el archivo', 'take'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ── navigation ── */
  const openDrawer = (container, i) => {
    const fresh = containers.find(c => c.id === container.id) || container;
    setActiveContainer(fresh); setActiveDrawer(i); setView('drawer');
  };
  const openContainer = (container) => {
    const fresh = containers.find(c => c.id === container.id) || container;
    setActiveContainer(fresh); setView('container');
  };
  const goWorkshop = () => { setView('workshop'); setActiveContainer(null); };

  const trail = useMemo(() => {
    const t = [{ label:'Taller', view:'workshop' }];
    if (activeContainer) t.push({ label: activeContainer.name, view:'container' });
    if (view === 'drawer' && activeContainer) t.push({ label: getDrawerLabel(activeContainer, activeDrawer), view:'drawer' });
    return t;
  }, [activeContainer, activeDrawer, view]);
  const jumpTo = (i) => { const target = trail[i]; if (target.view === 'workshop') goWorkshop(); else if (target.view === 'container') setView('container'); };

  /* ── derived ── */
  const metrics = useMemo(() => {
    const totalUnits = tools.reduce((a,t) => a+t.total, 0);
    const available = tools.reduce((a,t) => a+t.current, 0);
    return { totalUnits, available, out: totalUnits - available, types: tools.length };
  }, [tools]);

  const drawerTools = useMemo(() => {
    if (!activeContainer) return [];
    return tools.filter(t => t.container === activeContainer.id && t.drawer === activeDrawer);
  }, [tools, activeContainer, activeDrawer]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tools;
    if (filterCat !== 'Todas') list = list.filter(t => t.category === filterCat);
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q) || t.serial.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    return list;
  }, [tools, search, filterCat]);

  const searching = search.trim() !== '' || filterCat !== 'Todas';
  const containerName = (id) => containers.find(c => c.id === id)?.name || '—';
  const drawerNameOf = (t) => { const c = containers.find(c => c.id === t.container); return c ? getDrawerLabel(c, t.drawer) : ''; };

  const editTool = requireEdit((tool) => { setEditing(tool); setModalOpen(true); });
  const openCheckout = requireEdit((tool, mode) => setCheckout({ tool, mode }));
  const setToolStatus = requireEdit(inv.setToolStatus);

  return (
    <AuthGate session={inv.session} authReady={inv.authReady}>
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-steel-200 bg-steel-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-steel-800 text-white shadow-soft"><Icon name="wrench" size={22}/></span>
            <div><h1 className="font-display text-xl font-bold leading-none text-ink">Taller</h1><p className="text-xs text-ink-mute">Gestion de Inventario</p></div>
          </div>
          <div className="flex items-center gap-2">
            {sb && (
              <span className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${inv.dbConnected ? 'bg-sage-100 text-sage-600' : inv.dbLoading ? 'bg-amber-100 text-amber-700' : 'bg-steel-100 text-ink-mute'}`}>
                <span className={`h-2 w-2 rounded-full ${inv.dbConnected ? 'bg-sage-500' : inv.dbLoading ? 'bg-amber-400 animate-pulse' : 'bg-steel-300'}`}/>
                {inv.dbConnected ? 'Sincronizado' : inv.dbLoading ? 'Conectando...' : 'Desconectado'}
              </span>
            )}
            {inv.pendingOps > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700" title="Cambios pendientes de sincronizar">
                <Icon name="cloud-off" size={13}/> {inv.pendingOps}
              </span>
            )}
            <div className="hidden sm:flex items-center gap-1">
              <button onClick={exportData} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-medium text-ink-soft shadow-soft transition hover:bg-steel-50" title="Exportar inventario">
                <Icon name="download" size={16}/> <span className="hidden md:inline">Exportar</span>
              </button>
              <button onClick={requireAdmin(() => fileInputRef.current?.click())} className="flex items-center gap-1.5 rounded-xl border border-steel-200 bg-white px-3 py-2 text-sm font-medium text-ink-soft shadow-soft transition hover:bg-steel-50" title="Importar inventario">
                <Icon name="upload" size={16}/> <span className="hidden md:inline">Importar</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importData}/>
            </div>
            {!inv.isVisitor && (
              <button onClick={() => { setEditing(null); setModalOpen(true); }}
                className="flex items-center gap-2 rounded-xl bg-steel-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900 active:scale-95">
                <Icon name="plus" size={18}/> <span className="hidden sm:inline">Nueva herramienta</span><span className="sm:hidden">Nueva</span>
              </button>
            )}
            {sb && inv.session && (
              <button onClick={() => setTeamOpen(true)} title="Equipo del taller"
                className="grid h-9 w-9 place-items-center rounded-xl border border-steel-200 bg-white text-ink-mute shadow-soft transition hover:bg-steel-50 hover:text-steel-700">
                <Icon name="users" size={16}/>
              </button>
            )}
            {sb && inv.session && (
              <button onClick={() => authSignOut()} title={`Cerrar sesión (${inv.session.user.email})`}
                className="grid h-9 w-9 place-items-center rounded-xl border border-steel-200 bg-white text-ink-mute shadow-soft transition hover:bg-steel-50 hover:text-clay-600">
                <Icon name="log-out" size={16}/>
              </button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); goWorkshop(); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-steel-800 text-white shadow-soft' : 'text-ink-soft hover:bg-steel-100'}`}>
              <Icon name={t.icon} size={15}/> {t.label}
              {t.key === 'historia' && openLoans.length > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">{openLoans.length}</span>}
              {t.key === 'reponer' && lowStockCount > 0 && <span className="rounded-full bg-clay-500 px-1.5 text-[10px] font-bold text-white">{lowStockCount}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5">
        {tab === 'taller' && (
          <>
            <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard icon="package" label="Tipos de herramienta" value={metrics.types} tone="steel"/>
              <MetricCard icon="check-circle" label="Disponibles" value={metrics.available} tone="sage"/>
              <MetricCard icon="hand" label="Prestadas / fuera" value={metrics.out} tone="clay" onClick={() => setTab('historia')}/>
              <MetricCard icon="shopping-cart" label="Bajo stock mínimo" value={lowStockCount} tone={lowStockCount > 0 ? 'clay' : 'steel'} alert={lowStockCount > 0} onClick={() => setTab('reponer')}/>
            </section>

            <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute"><Icon name="search" size={18}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, serie o categoria..."
                  className="w-full rounded-xl border border-steel-200 bg-white py-2.5 pl-11 pr-4 text-sm text-ink shadow-soft outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200"/>
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink"><Icon name="x" size={16}/></button>}
              </div>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="rounded-xl border border-steel-200 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft shadow-soft outline-none">
                <option value="Todas">Todas las categorias</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </section>

            {searching ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-ink">{searchResults.length} {searchResults.length===1?'resultado':'resultados'}</h2>
                  <button onClick={() => { setSearch(''); setFilterCat('Todas'); }} className="text-sm font-medium text-steel-600 hover:text-steel-800">Limpiar filtros</button>
                </div>
                {searchResults.length === 0
                  ? <EmptyState icon="search" title="Sin coincidencias" subtitle="Prueba con otro termino o categoria."/>
                  : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {searchResults.map(t => (
                        <div key={t.id}>
                          <p className="mb-1.5 flex items-center gap-1 px-1 text-xs text-ink-mute"><Icon name="map-pin" size={12}/> {containerName(t.container)} · {drawerNameOf(t)}</p>
                          <ToolCard tool={t} loans={loansByTool(openLoans, t.id)} onCheckout={openCheckout} onEdit={editTool} onDelete={requireAdmin(setConfirm)} onSetStatus={setToolStatus}/>
                        </div>
                      ))}
                    </div>
                }
              </section>
            ) : (
              <>
                {view === 'workshop' && (
                  <>
                    <div className="mb-5">
                      <div className="mb-3 flex items-center justify-between">
                        <button onClick={() => setShowMap(m => !m)} className="flex items-center gap-2 text-sm font-semibold text-steel-700">
                          <Icon name={showMap ? 'chevron-down' : 'chevron-right'} size={16}/> {showMap ? 'Ocultar' : 'Mostrar'} mapa
                        </button>
                        {showMap && inv.isAdmin && (
                          <button onClick={() => setMapEditMode(m => !m)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${mapEditMode ? 'bg-amber-500 text-white shadow-soft' : 'border border-steel-200 bg-white text-steel-600 shadow-soft hover:bg-steel-50'}`}>
                            <Icon name={mapEditMode ? 'check' : 'pencil'} size={15}/> {mapEditMode ? 'Listo' : 'Editar mapa'}
                          </button>
                        )}
                      </div>
                      {showMap && (
                        <InteractiveMap
                          containers={containers} tools={tools} editMode={mapEditMode}
                          entrance={inv.entrance} onCommitEntrance={inv.saveEntrance}
                          onUpdateContainer={inv.updateContainer}
                          onCommitContainer={inv.commitContainer}
                          onDeleteContainer={handleDeleteContainer}
                          onSelect={openContainer}
                          onAddFurniture={() => setFurnitureModal({ open:true, editing:null })}
                          onEditFurniture={c => setFurnitureModal({ open:true, editing:c })}
                        />
                      )}
                    </div>
                    <h2 className="mb-3 font-display text-lg font-semibold text-ink">Contenedores de almacenamiento</h2>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      {containers.map(c => (
                        <StorageContainer key={c.id} container={c} tools={tools} onOpen={openDrawer}
                          onEditFurniture={inv.isAdmin ? (cont => setFurnitureModal({ open:true, editing:cont })) : null}
                          onEditDrawers={inv.isAdmin ? (cont => setDrawerEditor(cont)) : null}/>
                      ))}
                    </div>
                  </>
                )}
                {view === 'container' && activeContainer && (
                  <ContainerView container={activeContainer} tools={tools} trail={trail} onJump={jumpTo}
                    onOpenDrawer={i => openDrawer(activeContainer, i)} onBack={goWorkshop}
                    onEditDrawers={requireAdmin(() => setDrawerEditor(activeContainer))}/>
                )}
                {view === 'drawer' && activeContainer && (
                  <DrawerView container={activeContainer} drawerIndex={activeDrawer} tools={drawerTools} openLoans={openLoans}
                    trail={trail} onJump={jumpTo} onChangeDrawer={setActiveDrawer}
                    onCheckout={openCheckout}
                    onEdit={editTool} onDelete={requireAdmin(setConfirm)} onSetStatus={setToolStatus}
                    onAddHere={requireEdit(() => { setEditing(null); setModalOpen(true); })}
                    onBack={() => setView('container')}/>
                )}
              </>
            )}
          </>
        )}

        {tab === 'tabla' && <TableView tools={tools} containers={containers} onEdit={editTool}
          deletedTools={deletedTools}
          onRestore={requireEdit(t => { inv.restoreTool(t); fireToast('Herramienta restaurada', 'add'); })}
          onPurge={requireAdmin(t => { inv.purgeTool(t); fireToast('Eliminada definitivamente', 'info'); })}/>}
        {tab === 'historia' && <HistoryView transactions={transactions} tools={allTools} containers={containers}/>}
        {tab === 'reponer' && <ReorderPanel tools={tools} containerName={containerName}/>}
        {tab === 'deseos' && <WishlistView wishlist={wishlist} canEdit={!inv.isVisitor} isAdmin={inv.isAdmin}
          onSave={w => { inv.saveWish(w); fireToast('Material guardado', 'info'); }}
          onDelete={id => { inv.deleteWish(id); fireToast('Material quitado de la lista', 'info'); }}/>}
        {tab === 'kits' && <KitsView kits={kits} tools={tools} onSaveKit={requireEdit(k => { inv.saveKit(k); fireToast('Kit guardado', 'info'); })} onDeleteKit={requireAdmin(id => { inv.deleteKit(id); fireToast('Kit eliminado', 'info'); })}/>}
        {tab === 'auditoria' && <CycleCountView containers={containers} tools={tools} transactions={transactions}
          onApplyCount={requireEdit(inv.applyCount)} onRecordAudit={requireEdit(inv.recordAudit)} auditor={defaultPerson}/>}
        {tab === 'qr' && <QrSheet tools={tools} containers={containers}/>}
      </main>

      {/* Modals */}
      <ToolModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSaveTool} initial={editing} containers={containers} customIcons={customIcons}
        defaultLocation={view === 'drawer' && activeContainer ? { container: activeContainer.id, drawer: activeDrawer } : null}/>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirmDelete} title="Eliminar herramienta?" message={confirm ? `"${confirm.name}" se quitara del inventario de forma permanente.` : ''}/>
      <ConfirmDialog open={!!confirmFurniture} onClose={() => setConfirmFurniture(null)}
        onConfirm={() => { inv.removeContainer(confirmFurniture.id, true); fireToast('Mueble y herramientas eliminados', 'info'); setConfirmFurniture(null); }}
        title="Eliminar mueble?" message={confirmFurniture ? `"${confirmFurniture.name}" tiene ${confirmFurniture.toolCount} herramienta(s). Se eliminaran todas.` : ''}/>
      <FurnitureModal open={furnitureModal.open} onClose={() => setFurnitureModal({open:false,editing:null})}
        onSave={f => { inv.saveContainer(f); setFurnitureModal({open:false,editing:null}); fireToast(furnitureModal.editing ? 'Mueble actualizado' : 'Mueble agregado', 'info'); }}
        editing={furnitureModal.editing}/>
      <DrawerEditorModal open={!!drawerEditor} container={drawerEditor}
        toolCounts={drawerEditor ? Array.from({ length: drawerEditor.drawers }).map((_, i) => tools.filter(t => t.container === drawerEditor.id && t.drawer === i).length) : []}
        onClose={() => setDrawerEditor(null)} onSave={handleSaveDrawers}/>
      <CheckoutModal open={!!checkout} mode={checkout?.mode} tool={checkout?.tool ? tools.find(t => t.id === checkout.tool.id) : null}
        defaultPerson={defaultPerson} onClose={() => setCheckout(null)} onConfirm={handleCheckoutConfirm}/>

      <TeamPanel open={teamOpen} onClose={() => setTeamOpen(false)} isAdmin={inv.isAdmin}
        myId={inv.session?.user?.id} onToast={fireToast}/>

      {/* Chat LLM */}
      <button onClick={() => setChatOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full shadow-lift transition active:scale-90 ${chatOpen ? 'bg-steel-600 text-white' : 'bg-steel-800 text-white hover:bg-steel-900'}`}>
        <Icon name={chatOpen ? 'x' : 'bot'} size={24}/>
      </button>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} containers={containers} tools={tools} transactions={transactions}
        onMovement={requireEdit(handleCheckoutConfirm)} defaultPerson={defaultPerson}/>

      <Toast toast={toast}/>
    </div>
    </AuthGate>
  );
}
