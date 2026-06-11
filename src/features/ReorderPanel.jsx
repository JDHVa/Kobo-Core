import { useMemo } from 'react';
import { Icon, ToolIconDisplay, EmptyState } from '../components/ui';
import { belowMin } from '../lib/utils';

// Panel de reorden (técnica: reorder point / min-max inventory)
export function ReorderPanel({ tools, containerName }) {
  const low = useMemo(() => tools.filter(belowMin).sort((a, b) => (a.current / a.minStock) - (b.current / b.minStock)), [tools]);

  return (
    <div className="animate-fade-up rounded-3xl border border-steel-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-clay-100 text-clay-600"><Icon name="shopping-cart" size={22}/></span>
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">Reponer pronto</h3>
          <p className="text-xs text-ink-mute">Herramientas y consumibles por debajo de su stock mínimo</p>
        </div>
      </div>
      {low.length === 0
        ? <EmptyState icon="check-circle" title="Stock saludable" subtitle="Nada está por debajo de su mínimo. Define 'Stock mínimo' al editar una herramienta para activar alertas."/>
        : <div className="space-y-2">
            {low.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-clay-200 bg-clay-50/40 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-steel-600">
                  <ToolIconDisplay icon={t.icon} iconUrl={t.iconUrl} size={22}/>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                  <p className="text-xs text-ink-mute">{containerName(t.container)} · quedan <span className="font-bold text-clay-600">{t.current}</span> de mínimo {t.minStock}</p>
                </div>
                <span className="shrink-0 rounded-full bg-clay-500 px-2.5 py-1 text-[11px] font-bold text-white">faltan {t.minStock - t.current}</span>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
