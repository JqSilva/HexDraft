import React from 'react';

export interface RankBadgeProps {
  tier?: string;
  division?: string;
  className?: string;
  size?: 'sm' | 'md' | 'xs';
}

/**
 * Devuelve el color de texto correspondiente a la liga/tier de League of Legends.
 */
export const getTierColorClass = (tier: string = 'UNRANKED'): string => {
  switch (tier.toUpperCase()) {
    case 'CHALLENGER':
    case 'GRANDMASTER':
    case 'MASTER':
      return 'text-purple-accent-hover border-purple-accent/30 bg-purple-accent/10';
    default:
      return 'text-slate-300 border-border-warm bg-panel-warm';
  }
};

/**
 * Componente reusable para renderizar la insignia/badge de rango/tier.
 */
export const RankBadge: React.FC<RankBadgeProps> = ({
  tier = 'UNRANKED',
  division,
  className = '',
  size = 'md'
}) => {
  const colorClass = getTierColorClass(tier);
  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1';
  const isApex = ['MASTER', 'GRANDMASTER', 'GM', 'CHALLENGER'].includes(tier.toUpperCase());
  const displayDivision = isApex ? '' : division;

  return (
    <span className={`inline-flex items-center font-medium tracking-wide border rounded-md ${colorClass} ${sizeClass} ${className}`}>
      {tier} {displayDivision ? displayDivision : ''}
    </span>
  );
};
