import React from 'react';
import { hydrateAsset } from '../../../lib/engine/core/hydrator';
import { 
  RUNE_TREES, 
  getTreeColors, 
  SHARDS_ROWS, 
  normalizeShardIdForHighlight, 
  getRuneAlias 
} from './utils';

export const RuneTree = ({ styleId, selections, isPrimary }: { styleId: number; selections: number[]; isPrimary: boolean }) => {
  const tree = RUNE_TREES[styleId];
  const colors = getTreeColors(styleId);

  if (!tree) {
    return (
      <div className="flex flex-col gap-2">
        {selections.map(id => {
          const r = hydrateAsset('runes', id);
          return (
            <div key={id} className="flex items-center gap-2">
              {r?.icon && <img src={r.icon} className="w-6 h-6 object-contain" alt={r.name} />}
              <span className="text-xs text-slate-300">{r?.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const rowsToShow = isPrimary ? tree.rows : tree.rows.slice(1);

  return (
    <div className="flex flex-col gap-2 items-center">
      {rowsToShow.map((row, rowIdx) => {
        const isKeystoneRow = isPrimary && rowIdx === 0;
        return (
          <div key={rowIdx} className="flex gap-2.5 justify-center items-center">
            {row.map(runeId => {
              const r = hydrateAsset('runes', runeId);
              const isActive = selections.some(selId => getRuneAlias(selId).includes(runeId));
              return (
                <div
                  key={runeId}
                  className={`relative flex items-center justify-center rounded-full transition-all duration-200 cursor-default
                    ${isKeystoneRow 
                      ? 'w-10 h-10 border-2' 
                      : 'w-8 h-8 border'}
                    ${isActive 
                      ? `${colors.border} ${colors.bg} ${colors.shadow} scale-110 ring-2 ring-purple-500/10`
                      : isKeystoneRow
                        ? 'border-slate-800 bg-black/40 opacity-30 grayscale hover:opacity-60 hover:border-slate-700'
                        : 'border-slate-800/60 bg-black/30 opacity-30 grayscale hover:opacity-60 hover:border-slate-700/60'}`}
                  title={r?.name}
                >
                  {r?.icon && (
                    <img 
                      src={r.icon} 
                      className={`${isKeystoneRow ? 'w-4/5 h-4/5' : 'w-3/4 h-3/4'} object-contain`} 
                      alt={r.name} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const ShardsTree = ({ selections }: { selections: number[] }) => {
  return (
    <div className="flex flex-col gap-2 items-center">
      {SHARDS_ROWS.map((row, rowIdx) => {
        const selectedId = selections[rowIdx];
        const normalizedSelectedId = normalizeShardIdForHighlight(selectedId, rowIdx);
        return (
          <div key={rowIdx} className="flex gap-2 justify-center items-center">
            {row.map(shardId => {
              const s = hydrateAsset('shards', shardId);
              const isActive = shardId === normalizedSelectedId;
              return (
                <div
                  key={shardId}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200 cursor-default
                    ${isActive 
                      ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_6px_rgba(234,179,8,0.25)] scale-110' 
                      : 'border-slate-800/40 bg-black/20 opacity-30 grayscale hover:opacity-60 hover:border-slate-700/40'}`}
                  title={s?.name}
                >
                  {s?.icon && (
                    <img src={s.icon} className="w-3.5 h-3.5 object-contain" alt={s.name} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
