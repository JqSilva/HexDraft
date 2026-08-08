import React from 'react';
import { useProBuild } from '../hooks/useProBuild';
import { hydrateAsset } from '../lib/engine/hydrator.js';
import { RUNE_TREES } from './react/champions/utils';

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
    return `hace ${diffHours}h`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays}d`;
  }
}

export const ProBuildPanel: React.FC<ProBuildPanelProps> = ({
  championName,
  opponentName,
  role,
  patch = '16.15',
  isCompact = false
}) => {
  const { loading, data, error, insufficientData, archetype, cachedAt } = useProBuild(
    championName,
    opponentName,
    role || 'top',
    patch
  );

  if (!championName) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full p-4 rounded-sm bg-panel-warm border border-border-warm text-slate-300 text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-slate-800 rounded-sm"></div>
          <div className="h-4 w-16 bg-slate-800 rounded-sm"></div>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Consultando perfiles Top OTPs de EUW y Challenger/GM en OP.GG...
        </div>
      </div>
    );
  }

  if (insufficientData) {
    return (
      <div className="w-full p-3.5 rounded-sm bg-panel-warm border border-border-warm text-slate-400 text-xs text-center font-mono">
        Datos insuficientes para este matchup en OP.GG
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full p-3.5 rounded-sm bg-panel-warm border border-border-warm text-slate-400 text-xs text-center font-mono">
        {error || 'No se pudo obtener información de OP.GG'}
      </div>
    );
  }

  const freshnessText = formatFreshness(cachedAt);
  const keystoneId = data.runes.selections[0];
  const primaryRunes = data.runes.selections.slice(0, 4);
  const secondaryRunes = data.runes.selections.slice(4, 6);
  const shards = data.runes.shards.slice(0, 3);

  const primaryTree = RUNE_TREES[data.runes.primaryStyleId];
  const secondaryTree = RUNE_TREES[data.runes.subStyleId];

  const badgeText = data.source === 'otp_matchup'
    ? `Matchup OTP (Top ${data.otpRank || 1} EUW: ${data.otpName || ''})`
    : data.source === 'otp_general'
    ? `Build OTP (Top 1 EUW: ${data.otpName || ''})`
    : 'Challenger / Master GM';

  return (
    <div className="w-full rounded-sm bg-panel-warm border border-border-warm p-3.5 flex flex-col gap-3 text-slate-200">
      {/* Cabecera Pro Build */}
      <div className="flex flex-col gap-1 border-b border-border-warm/60 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {badgeText}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {freshnessText}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
            {data.winRate}% WR
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
          <span>{data.sampleSize.toLocaleString()} partidas analizadas (Parche {data.patch})</span>
          {archetype && (
            <span className="text-amber-400/90 font-sans text-[10.5px]">vs arquetipo {archetype}</span>
          )}
        </div>
      </div>

      {/* Sección 1: Runas y 3 Fragmentos de Estadísticas */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">
          <span>Runas & Fragmentos</span>
          <span className="text-[10px] font-normal text-slate-400 font-mono">
            {primaryTree?.name || 'Primaria'} + {secondaryTree?.name || 'Secundaria'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-sm border border-border-warm/40 overflow-x-auto">
          {/* Keystone */}
          {keystoneId && (
            <div className="flex items-center gap-1 shrink-0" title={hydrateAsset('runes', keystoneId)?.name || 'Keystone'}>
              <img
                src={hydrateAsset('runes', keystoneId)?.icon || ''}
                alt="Keystone"
                className="w-9 h-9 rounded-full border border-amber-400/80 bg-slate-900 shrink-0"
              />
            </div>
          )}

          <div className="h-8 w-px bg-border-warm/40 shrink-0"></div>

          {/* Rama Primaria (4 perks) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {primaryRunes.map((runeId, idx) => {
              const asset = hydrateAsset('runes', runeId);
              return (
                <img
                  key={idx}
                  src={asset?.icon || ''}
                  alt={asset?.name || `Runa Primaria ${idx}`}
                  title={asset?.name || `Runa Primaria ${idx}`}
                  className="w-6.5 h-6.5 rounded-full bg-slate-900 border border-border-warm shrink-0"
                />
              );
            })}
          </div>

          <div className="h-8 w-px bg-border-warm/40 shrink-0"></div>

          {/* Rama Secundaria (2 perks) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {secondaryRunes.map((runeId, idx) => {
              const asset = hydrateAsset('runes', runeId);
              return (
                <img
                  key={idx}
                  src={asset?.icon || ''}
                  alt={asset?.name || `Runa Secundaria ${idx}`}
                  title={asset?.name || `Runa Secundaria ${idx}`}
                  className="w-6.5 h-6.5 rounded-full bg-slate-900 border border-border-warm shrink-0"
                />
              );
            })}
          </div>

          <div className="h-8 w-px bg-border-warm/40 shrink-0"></div>

          {/* 3 Fragmentos / Shards exactos */}
          <div className="flex items-center gap-1 shrink-0">
            {shards.map((shardId, idx) => {
              const asset = hydrateAsset('shards', shardId);
              return (
                <img
                  key={idx}
                  src={asset?.icon || ''}
                  alt={asset?.name || `Fragmento ${idx + 1}`}
                  title={asset?.name || `Fragmento ${idx + 1}`}
                  className="w-5 h-5 rounded-full bg-slate-900 border border-border-warm/60 shrink-0"
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Sección 2: Iniciales, Invocadores, Core Build y Botas */}
      <div className={`grid ${isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-2.5`}>
        {/* Objetos Iniciales y Hechizos */}
        <div className="flex flex-col gap-1 bg-slate-950/50 p-2.5 rounded-sm border border-border-warm/40">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Inicio e Invocadores
          </span>
          <div className="flex items-center gap-2.5">
            {/* Iniciales */}
            <div className="flex items-center gap-1">
              {data.starterItems.map((itemId, idx) => {
                const asset = hydrateAsset('items', itemId);
                return (
                  <img
                    key={idx}
                    src={asset?.icon || ''}
                    alt={asset?.name || `Inicial ${itemId}`}
                    title={asset?.name || `Inicial ${itemId}`}
                    className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900"
                  />
                );
              })}
            </div>

            <div className="h-6 w-px bg-border-warm/40"></div>

            {/* Hechizos (D y F) */}
            <div className="flex items-center gap-1">
              {data.summoners.map((spellId, idx) => {
                const asset = hydrateAsset('summoners', spellId);
                return (
                  <img
                    key={idx}
                    src={asset?.icon || ''}
                    alt={asset?.name || `Hechizo ${spellId}`}
                    title={asset?.name || `Hechizo ${spellId}`}
                    className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900"
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Core Build y Botas */}
        <div className="flex flex-col gap-1 bg-slate-950/50 p-2.5 rounded-sm border border-border-warm/40">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Core Build & Botas
          </span>
          <div className="flex items-center gap-2">
            {/* 3 Core Items */}
            <div className="flex items-center gap-1">
              {data.coreItems.map((itemId, idx) => {
                const asset = hydrateAsset('items', itemId);
                return (
                  <img
                    key={idx}
                    src={asset?.icon || ''}
                    alt={asset?.name || `Core ${itemId}`}
                    title={asset?.name || `Core ${itemId}`}
                    className="w-7 h-7 rounded-sm border border-amber-400/60 bg-slate-900"
                  />
                );
              })}
            </div>

            <div className="h-6 w-px bg-border-warm/40"></div>

            {/* Botas */}
            {data.boots && (
              <div title={hydrateAsset('items', data.boots)?.name || 'Botas'}>
                <img
                  src={hydrateAsset('items', data.boots)?.icon || ''}
                  alt="Botas"
                  className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
