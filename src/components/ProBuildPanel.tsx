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
  allies?: string[];
  enemies?: string[];
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
  isCompact = false,
  allies = [],
  enemies = []
}) => {
  const {
    loading,
    data,
    builds,
    activeBuildIndex,
    setActiveBuildIndex,
    error,
    insufficientData,
    archetype,
    cachedAt
  } = useProBuild(
    championName,
    opponentName,
    role || 'top',
    patch,
    allies,
    enemies
  );

  if (!championName) {
    return null;
  }

  const primaryTree = data?.runes ? RUNE_TREES[data.runes.primaryStyleId] : null;
  const secondaryTree = data?.runes ? RUNE_TREES[data.runes.subStyleId] : null;

  const tabTitle = data?.source === 'otp_matchup'
    ? `PRO BUILD (OTP #${data.otpRank || 1} ${data.otpName || ''})`
    : data?.source === 'otp_general'
    ? `PRO BUILD (OTP #${data.otpRank || 1} ${data.otpName || ''})`
    : 'BUILD PRO OP.GG';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden">
      {/* Cabecera / Pestañas de Builds Superiores Alineadas */}
      <div className="flex justify-between items-end gap-3 shrink-0 h-[52px] -mb-px">
        <div className="flex gap-1 items-end flex-1 min-w-0 -mb-px z-10 overflow-x-auto">
          {builds && builds.length > 1 ? (
            builds.map((b, idx) => {
              const isActive = idx === activeBuildIndex;
              const keystone = b.runes?.selections?.[0];
              const tabStyle = isActive
                ? 'bg-[#12131a] border border-border-warm/50 border-b-transparent tech-corners-sup rounded-t-sm z-20 font-extrabold text-amber-400'
                : 'bg-[#0a0a0e]/70 border border-border-warm/30 rounded-t-sm text-slate-400 hover:text-slate-200 hover:bg-[#101015]';

              return (
                <button
                  key={`build-tab-${idx}`}
                  onClick={() => setActiveBuildIndex(idx)}
                  className={`h-[52px] flex items-center gap-2 transition-colors cursor-pointer select-none px-3.5 shrink-0 ${tabStyle}`}
                >
                  {keystone && (
                    <img
                      src={hydrateAsset('runes', keystone)?.icon || ''}
                      className="w-5 h-5 rounded-full border border-amber-400/50 bg-slate-950 shrink-0"
                      alt="keystone"
                    />
                  )}
                  <span className="text-[10px] md:text-[10.5px] uppercase tracking-wider font-bold truncate max-w-[130px]">
                    {b.title || `Build #${idx + 1}`}
                  </span>
                </button>
              );
            })
          ) : (
            <span className={`bg-[#12131a] border border-border-warm/50 border-b-transparent tech-corners-sup rounded-t-sm z-20 font-extrabold uppercase text-amber-400 select-none h-[52px] flex items-center justify-center gap-2
              ${isCompact
                ? 'px-3 tracking-[0.1em] text-[9.5px]'
                : 'px-5 tracking-[0.25em] text-[10px] md:text-[11px]'
              }`}>
              {tabTitle}
            </span>
          )}
        </div>

        {/* Badge de Winrate y Frescura en la esquina superior derecha */}
        {data && (
          <div className="border border-border-warm/50 border-b-transparent rounded-t-sm select-none z-20 flex items-center justify-center gap-2 px-3 h-[38px] bg-[#0c0c10] text-[10px] font-mono shrink-0">
            <span className="text-slate-400">{formatFreshness(cachedAt)}</span>
            <span className="text-emerald-400 font-bold">{data.winRate}% WR</span>
          </div>
        )}
      </div>

      {/* Contenido Principal de la Build */}
      <div className="flex-grow p-3 md:p-4 bg-bg-warm/30 border border-border-warm/50 rounded-sm rounded-tl-none flex flex-col gap-3 overflow-hidden">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-[11px] text-center">
            <div className="w-6 h-6 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin"></div>
            <span>Consultando datos estadísticos de OP.GG...</span>
          </div>
        ) : insufficientData ? (
          <div className="h-full w-full flex items-center justify-center text-slate-400 font-mono text-[11px] text-center">
            Datos insuficientes para este matchup en OP.GG
          </div>
        ) : error || !data ? (
          <div className="h-full w-full flex items-center justify-center text-slate-400 font-mono text-[11px] text-center">
            {error || 'No se pudo obtener información de OP.GG'}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-tactical pr-1 flex flex-col gap-3.5">
            {/* Subtítulo de Matchup / Arquetipo */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-border-warm/30 pb-2">
              <span className="text-slate-300 font-bold">
                {data.source === 'otp_matchup' ? `Matchup específico vs ${opponentName || archetype || 'rival'}` : `Configuración para ${championName} (${data.title || 'OP.GG'})`}
              </span>
              <span>Parche {data.patch}</span>
            </div>

            {/* Grid Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Bloque 1: Runas y Shards */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Runas: {primaryTree?.name || 'Primaria'} + {secondaryTree?.name || 'Secundaria'}
                </span>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {/* Keystone */}
                  {data.runes?.selections?.[0] && (
                    <div title={hydrateAsset('runes', data.runes.selections[0])?.name || 'Keystone'}>
                      <img
                        src={hydrateAsset('runes', data.runes.selections[0])?.icon || ''}
                        alt="Keystone"
                        className="w-9 h-9 rounded-full border border-amber-400/80 bg-slate-950 shrink-0"
                      />
                    </div>
                  )}

                  <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>

                  {/* 3 Primarias */}
                  <div className="flex items-center gap-1 shrink-0">
                    {data.runes?.selections?.slice(1, 4).map((runeId, idx) => {
                      const asset = hydrateAsset('runes', runeId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Runa'}
                          title={asset?.name || 'Runa'}
                          className="w-6 h-6 rounded-full bg-slate-900 border border-border-warm shrink-0"
                        />
                      );
                    })}
                  </div>

                  <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>

                  {/* 2 Secundarias */}
                  <div className="flex items-center gap-1 shrink-0">
                    {data.runes?.selections?.slice(4, 6).map((runeId, idx) => {
                      const asset = hydrateAsset('runes', runeId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Runa'}
                          title={asset?.name || 'Runa'}
                          className="w-6 h-6 rounded-full bg-slate-900 border border-border-warm shrink-0"
                        />
                      );
                    })}
                  </div>

                  <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>

                  {/* 3 Shards exactos */}
                  <div className="flex items-center gap-1 shrink-0">
                    {data.runes?.shards?.slice(0, 3).map((shardId, idx) => {
                      const asset = hydrateAsset('shards', shardId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Fragmento'}
                          title={asset?.name || 'Fragmento'}
                          className="w-4.5 h-4.5 rounded-full bg-slate-900 border border-border-warm/60 shrink-0"
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Inicio, Compras Tempranas, Invocadores y Botas */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Inicio, Temprano, Invocadores y Botas
                </span>
                <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                  {/* Starter Items */}
                  <div className="flex items-center gap-1" title="Objetos Iniciales">
                    {data.starterItems?.map((itemId, idx) => {
                      const asset = hydrateAsset('items', itemId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Starter Item'}
                          title={asset?.name || 'Starter Item'}
                          className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900 shrink-0"
                        />
                      );
                    })}
                  </div>

                  {/* Compra Temprana (Lágrima en 1er Back) */}
                  {data.earlyBuy && (
                    <>
                      <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>
                      <div className="flex items-center gap-1" title="1er Back: Lágrima de la Diosa">
                        <div className="relative flex flex-col items-center">
                          <img
                            src={hydrateAsset('items', data.earlyBuy)?.icon || ''}
                            alt="1er Back"
                            className="w-7 h-7 rounded-sm border border-cyan-400/90 bg-slate-900 shrink-0"
                          />
                          <span className="absolute -top-1.5 -right-1 bg-cyan-950 text-cyan-300 border border-cyan-400/60 text-[6.5px] font-black px-1 rounded-xs uppercase tracking-tighter">
                            1er Back
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>

                  {/* Hechizos de Invocador D y F */}
                  <div className="flex items-center gap-1" title="Hechizos de Invocador">
                    {data.summoners?.map((spellId, idx) => {
                      const asset = hydrateAsset('summoners', spellId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Hechizo'}
                          title={asset?.name || 'Hechizo'}
                          className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900 shrink-0"
                        />
                      );
                    })}
                  </div>

                  <div className="h-7 w-px bg-border-warm/30 shrink-0"></div>

                  {/* Botas */}
                  {data.boots && (
                    <div className="flex items-center gap-1" title={hydrateAsset('items', data.boots)?.name || 'Botas'}>
                      <img
                        src={hydrateAsset('items', data.boots)?.icon || ''}
                        alt="Botas"
                        className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900 shrink-0"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bloque 3: Ruta Completa de Objetos Completados */}
              <div className="flex flex-col gap-1.5 min-w-0 md:col-span-2 border-t border-border-warm/20 pt-2.5">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Ruta de Objetos Completados (Orden Cronológico)
                </span>
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-tactical pb-1 flex-wrap">
                  {data.coreItems?.map((itemId, idx) => {
                    const asset = hydrateAsset('items', itemId);
                    return (
                      <div key={idx} className="flex items-center gap-1.5 shrink-0" title={asset?.name || 'Item'}>
                        <div className="relative flex flex-col items-center">
                          <img
                            src={asset?.icon || ''}
                            alt={asset?.name || 'Item'}
                            className="w-8 h-8 rounded-sm bg-slate-900 border border-amber-400/70"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-black/90 text-amber-300/90 text-[7px] font-mono font-bold px-1 rounded-xs">
                            #{idx + 1}
                          </span>
                        </div>
                        {idx < data.coreItems.length - 1 && (
                          <span className="text-slate-600 font-bold text-xs">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bloque 4: Adaptaciones y Contramedidas Situacionales frente al rival */}
              {data.situationalSwaps && data.situationalSwaps.length > 0 && (
                <div className="flex flex-col gap-1.5 min-w-0 md:col-span-2 border-t border-border-warm/20 pt-2.5">
                  <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Opciones Situacionales (Frente al Equipo Rival)
                  </span>
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    {data.situationalSwaps.map((swap, idx) => {
                      const asset = hydrateAsset('items', swap.replacementItem);
                      return (
                        <div
                          key={`swap-${idx}`}
                          className="flex items-center gap-2 p-1.5 bg-[#0a0a0e]/60 border border-border-warm/30 rounded-sm text-[10.5px]"
                        >
                          <img
                            src={asset?.icon || ''}
                            alt={swap.title}
                            title={asset?.name || swap.title}
                            className="w-6 h-6 rounded-sm bg-slate-900 border border-border-warm shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-amber-300 text-[10px] leading-tight">
                              {swap.title}
                            </span>
                            <span className="text-slate-400 text-[9.5px] leading-tight truncate">
                              {swap.reason}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

