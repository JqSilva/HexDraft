import React from 'react';
import { useProBuild } from '../hooks/useProBuild';
import { getDDragonUrl } from '../lib/gameVersion.js';

interface ProBuildPanelProps {
  championName: string | null;
  opponentName: string | null;
  role: string | null;
  patch?: string;
  isCompact?: boolean;
}

function formatFreshness(cachedAt: number | null): string {
  if (!cachedAt) return 'reciente';
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diffSeconds = nowSeconds - cachedAt;
  const diffHours = Math.floor(diffSeconds / 3600);

  if (diffHours < 1) {
    return 'hace unos minutos';
  } else if (diffHours < 24) {
    return `hace ${diffHours} horas`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} días`;
  }
}

function getItemIcon(itemId: number): string {
  return getDDragonUrl('item', itemId);
}

function getRuneIcon(perkId: number): string {
  return `https://opgg-static.akamaized.net/meta/images/lol/perk/${perkId}.png`;
}

function getRuneStyleIcon(styleId: number): string {
  return `https://opgg-static.akamaized.net/meta/images/lol/perkStyle/${styleId}.png`;
}

function getSpellIcon(spellId: number): string {
  return `https://opgg-static.akamaized.net/meta/images/lol/spell/${spellId}.png`;
}

export const ProBuildPanel: React.FC<ProBuildPanelProps> = ({
  championName,
  opponentName,
  role,
  patch = '16.15',
  isCompact: _isCompact = false
}) => {
  const { loading, data, error, insufficientData, archetype, cachedAt } = useProBuild(
    championName,
    opponentName,
    role || 'top',
    patch
  );

  if (!championName || !opponentName) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full p-4 rounded bg-panel-warm/60 border border-border-warm/40 animate-pulse text-slate-300 text-xs flex flex-col gap-2">
        <div className="h-4 w-48 bg-slate-800 rounded"></div>
        <div className="h-3 w-64 bg-slate-800/80 rounded"></div>
        <div className="text-slate-400 font-mono text-[11px] mt-2">
          Consultando partidas de Challenger/GM en op.gg...
        </div>
      </div>
    );
  }

  if (insufficientData) {
    return (
      <div className="w-full p-3 rounded bg-panel-warm/40 border border-border-warm/30 text-slate-400 text-xs text-center font-mono">
        Datos insuficientes para este matchup
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full p-3 rounded bg-panel-warm/40 border border-border-warm/30 text-slate-400 text-xs text-center font-mono">
        {error || 'No se pudo obtener información de op.gg'}
      </div>
    );
  }

  const freshnessText = formatFreshness(cachedAt);
  const keystoneId = data.runes.selections[0];
  const primaryRunes = data.runes.selections.slice(0, 4);
  const secondaryRunes = data.runes.selections.slice(4, 6);

  return (
    <div className="w-full rounded bg-panel-warm border border-border-warm/60 p-3.5 flex flex-col gap-3 text-slate-200">
      {/* Encabezado Pro Build */}
      <div className="flex flex-col gap-1 border-b border-border-warm/40 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Vista Pro — Challenger/GM
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {freshnessText}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-400">
            {data.winRate}% WR
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
          <span>Basado en {data.sampleSize.toLocaleString()} partidas — parche {data.patch}</span>
          {archetype && (
            <span className="text-slate-300">vs arquetipo {archetype}</span>
          )}
        </div>
      </div>

      {/* Sección 1: Runas completas */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Runas y Fragmentos
        </span>
        <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded border border-border-warm/30">
          {/* Keystone grande */}
          {keystoneId && (
            <div className="flex flex-col items-center gap-1">
              <img
                src={getRuneIcon(keystoneId)}
                alt="Keystone"
                className="w-10 h-10 rounded-full border-2 border-amber-500/60 bg-slate-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getRuneStyleIcon(data.runes.primaryStyleId);
                }}
              />
            </div>
          )}

          <div className="h-10 w-px bg-border-warm/30"></div>

          {/* Rama Primaria */}
          <div className="flex items-center gap-1.5">
            {primaryRunes.map((runeId, idx) => (
              <img
                key={idx}
                src={getRuneIcon(runeId)}
                alt={`Primary Rune ${idx}`}
                className="w-7 h-7 rounded-full bg-slate-900 border border-border-warm/50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
          </div>

          <div className="h-10 w-px bg-border-warm/30"></div>

          {/* Rama Secundaria */}
          <div className="flex items-center gap-1.5">
            {secondaryRunes.map((runeId, idx) => (
              <img
                key={idx}
                src={getRuneIcon(runeId)}
                alt={`Secondary Rune ${idx}`}
                className="w-7 h-7 rounded-full bg-slate-900 border border-border-warm/50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
          </div>

          <div className="h-10 w-px bg-border-warm/30"></div>

          {/* Shards */}
          <div className="flex items-center gap-1">
            {data.runes.shards.map((shardId, idx) => (
              <img
                key={idx}
                src={getRuneIcon(shardId)}
                alt={`Shard ${idx}`}
                className="w-5 h-5 rounded-full bg-slate-900 border border-border-warm/40"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sección 2: Objetos iniciales, Core Build, Botas e Invocadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
        {/* Objetos Iniciales e Invocadores */}
        <div className="flex flex-col gap-1.5 bg-slate-950/40 p-2.5 rounded border border-border-warm/30">
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            Inicio e Invocadores
          </span>
          <div className="flex items-center gap-3">
            {/* Objetos iniciales */}
            <div className="flex items-center gap-1">
              {data.starterItems.map((itemId, idx) => (
                <img
                  key={idx}
                  src={getItemIcon(itemId)}
                  alt={`Starter item ${itemId}`}
                  className="w-7 h-7 rounded border border-border-warm/50"
                />
              ))}
            </div>

            <div className="h-6 w-px bg-border-warm/30"></div>

            {/* Hechizos de invocador */}
            <div className="flex items-center gap-1">
              {data.summoners.map((spellId, idx) => (
                <img
                  key={idx}
                  src={getSpellIcon(spellId)}
                  alt={`Summoner spell ${spellId}`}
                  className="w-7 h-7 rounded border border-border-warm/50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getDDragonUrl('spell', spellId);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Core Build y Botas */}
        <div className="flex flex-col gap-1.5 bg-slate-950/40 p-2.5 rounded border border-border-warm/30">
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            Core Build y Botas
          </span>
          <div className="flex items-center gap-2">
            {/* Core items */}
            <div className="flex items-center gap-1">
              {data.coreItems.map((itemId, idx) => (
                <img
                  key={idx}
                  src={getItemIcon(itemId)}
                  alt={`Core item ${itemId}`}
                  className="w-7 h-7 rounded border border-amber-500/40"
                />
              ))}
            </div>

            <div className="h-6 w-px bg-border-warm/30"></div>

            {/* Botas */}
            {data.boots && (
              <img
                src={getItemIcon(data.boots)}
                alt={`Boots ${data.boots}`}
                className="w-7 h-7 rounded border border-border-warm/50"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProBuildPanel;
