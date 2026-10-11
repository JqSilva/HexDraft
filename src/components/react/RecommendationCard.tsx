// src/components/react/RecommendationCard.tsx
import React, { memo } from 'react';
import { RecommendationTooltip } from './common/RecommendationTooltip';

interface Props {
  name: string;
  score: number;
  id: number;
  reasons?: string[];
  isBan?: boolean;
  onSelect?: () => void;
  isPending?: boolean;
  isPreselected?: boolean;
}

export const RecommendationCard = memo(({
  name,
  score,
  id,
  reasons = [],
  isBan = false,
  onSelect,
  isPending = false,
  isPreselected = false
}: Props) => {
  const imgBase = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/";

  // Colores semánticos acordes a Quiet Arcana
  const scoreColor = score >= 8
    ? 'text-status-success'
    : (score >= 6 ? 'text-status-warning' : 'text-status-danger');

  // Bordes Quiet Arcana: neutral en reposo, acento en hover/focus/selección activa
  const cardBorder = isPending
    ? 'border-violet-muted ring-1 ring-violet-muted/50 animate-pulse'
    : isPreselected
    ? (isBan ? 'border-status-danger ring-1 ring-status-danger/60' : 'border-violet ring-1 ring-violet/60')
    : (isBan
      ? 'border-ink-800 hover:border-status-danger/70 focus-visible:border-status-danger'
      : 'border-ink-800 hover:border-violet-muted focus-visible:border-violet-active');

  return (
    <RecommendationTooltip
      name={name}
      score={score}
      reasons={reasons}
      isBan={isBan}
      placement="top"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.();
          }
        }}
        aria-label={`${name}, puntuación ${score.toFixed(1)}${isBan ? ', baneo sugerido' : ''}${isPreselected ? ', preseleccionado' : ''}`}
        className={`recommendation-item group relative w-20 h-20 bg-ink-850 border ${cardBorder} rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-active/70`}
      >
        {/* Imagen del Campeón */}
        <div className="w-full h-full overflow-hidden rounded-lg">
          <img
            src={`${imgBase}${id}.png`}
            className="w-full h-full object-cover scale-[1.08] transition-opacity duration-200 group-hover:opacity-40"
            alt={name}
            loading="lazy"
          />
        </div>

        {/* Indicador discreto de operación en curso o preselección activa */}
        {isPending ? (
          <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet"></span>
            </span>
          </div>
        ) : isPreselected ? (
          <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
            <span className={`inline-block w-2 h-2 rounded-full ${isBan ? 'bg-status-danger' : 'bg-violet'}`} />
          </div>
        ) : null}

        {/* Badge de Score en la base */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-ink-900 border border-ink-700 ${scoreColor} shadow-md shadow-black/70`}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
    </RecommendationTooltip>
  );
});

RecommendationCard.displayName = 'RecommendationCard';

export default RecommendationCard;
