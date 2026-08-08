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

  const primaryTree = data?.runes ? RUNE_TREES[data.runes.primaryStyleId] : null;
  const secondaryTree = data?.runes ? RUNE_TREES[data.runes.subStyleId] : null;

  const tabTitle = data?.source === 'otp_matchup'
    ? `PRO BUILD (OTP #${data.otpRank || 1} ${data.otpName || ''})`
    : data?.source === 'otp_general'
    ? `PRO BUILD (OTP #${data.otpRank || 1} ${data.otpName || ''})`
    : 'BUILD PRO OP.GG';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden">
      {/* Cabecera / Pestaña Superior Alineada */}
      <div className="flex justify-between items-end gap-3 shrink-0 h-[52px] -mb-px">
        <div className="flex gap-1 items-end flex-1 min-w-0 -mb-px z-10">
          <span className={`bg-[#12131a] border border-border-warm/50 border-b-transparent tech-corners-sup rounded-t-sm z-20 font-extrabold uppercase text-amber-400 select-none h-[52px] flex items-center justify-center gap-2
            ${isCompact
              ? 'px-3 tracking-[0.1em] text-[9.5px]'
              : 'px-5 tracking-[0.25em] text-[10px] md:text-[11px]'
            }`}>
            {tabTitle}
          </span>
        </div>

        {/* Badge de Winrate y Frescura en la esquina superior derecha */}
        {data && (
          <div className="border border-border-warm/50 border-b-transparent rounded-t-sm select-none z-20 flex items-center justify-center gap-2 px-3 h-[38px] bg-[#0c0c10] text-[10px] font-mono">
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
            <span>Consultando perfiles Top OTPs de EUW y Challenger/GM en OP.GG...</span>
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
                {data.source === 'otp_matchup' ? `Matchup específico vs ${opponentName || archetype || 'rival'}` : `Configuración general OTP para ${championName}`}
              </span>
              <span>Parche {data.patch}</span>
            </div>

            {/* Grid 2x2 Limpio de Componentes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Bloque 1: Runas y Shards */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Runas: {primaryTree?.name || 'Primaria'} + {secondaryTree?.name || 'Secundaria'}
                </span>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {/* Keystone */}
                  {data.runes.selections[0] && (
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
                    {data.runes.selections.slice(1, 4).map((runeId, idx) => {
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
                    {data.runes.selections.slice(4, 6).map((runeId, idx) => {
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
                    {data.runes.shards.slice(0, 3).map((shardId, idx) => {
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

              {/* Bloque 2: Inicio e Invocadores */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Inicio e Invocadores
                </span>
                <div className="flex items-center gap-2.5 pt-1">
                  {/* Starter Items */}
                  <div className="flex items-center gap-1">
                    {data.starterItems.map((itemId, idx) => {
                      const asset = hydrateAsset('items', itemId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Starter Item'}
                          title={asset?.name || 'Starter Item'}
                          className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900"
                        />
                      );
                    })}
                  </div>

                  <div className="h-7 w-px bg-border-warm/30"></div>

                  {/* Hechizos de Invocador D y F */}
                  <div className="flex items-center gap-1">
                    {data.summoners.map((spellId, idx) => {
                      const asset = hydrateAsset('summoners', spellId);
                      return (
                        <img
                          key={idx}
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Hechizo'}
                          title={asset?.name || 'Hechizo'}
                          className="w-7 h-7 rounded-sm border border-border-warm bg-slate-900"
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bloque 3: Core Build (3 Items) */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Core Build
                </span>
                <div className="flex items-center gap-1.5 pt-1">
                  {data.coreItems.map((itemId, idx) => {
                    const asset = hydrateAsset('items', itemId);
                    return (
                      <div key={idx} className="flex items-center gap-1" title={asset?.name || 'Core Item'}>
                        <img
                          src={asset?.icon || ''}
                          alt={asset?.name || 'Core Item'}
                          className="w-8 h-8 rounded-sm border border-amber-400/60 bg-slate-900"
                        />
                        {idx < data.coreItems.length - 1 && (
                          <span className="text-slate-600 font-bold text-xs">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bloque 4: Botas */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block border-b border-border-warm/20 pb-1">
                  Botas
                </span>
                <div className="flex items-center gap-2 pt-1">
                  {data.boots && (
                    <div title={hydrateAsset('items', data.boots)?.name || 'Botas'}>
                      <img
                        src={hydrateAsset('items', data.boots)?.icon || ''}
                        alt="Botas"
                        className="w-8 h-8 rounded-sm border border-border-warm bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
