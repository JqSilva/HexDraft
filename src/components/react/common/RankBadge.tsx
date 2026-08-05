import React from 'react';

export interface RankBadgeProps {
  tier?: string;
  division?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Devuelve el color de texto correspondiente a la liga/tier de League of Legends.
 */
export const getTierColorClass = (tier: string = 'UNRANKED'): string => {
  switch (tier.toUpperCase()) {
    case 'CHALLENGER': return 'text-red-400 border-red-500/30 bg-red-500/10';
    case 'GRANDMASTER': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    case 'MASTER': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    case 'DIAMOND': return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
    case 'EMERALD': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'PLATINUM': return 'text-teal-400 border-teal-500/30 bg-teal-500/10';
    case 'GOLD': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    case 'SILVER': return 'text-slate-300 border-slate-400/30 bg-slate-400/10';
    case 'BRONZE': return 'text-amber-700 border-amber-700/30 bg-amber-700/10';
    case 'IRON': return 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10';
    default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
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
  const sizeClass = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center font-black uppercase tracking-widest border rounded ${colorClass} ${sizeClass} ${className}`}>
      {tier} {division ? division : ''}
    </span>
  );
};
