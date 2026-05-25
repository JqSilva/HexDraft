// src/components/react/RecommendationCard.tsx
import React from 'react';

interface Props {
    name: string;
    score: number;
    id: number;
    reasons?: string[]; // La hacemos opcional con el "?"
    isBan?: boolean;
}

export const RecommendationCard = ({ name, score, id, reasons = [], isBan = false }: Props) => {
    const scoreColor = score >= 8 ? 'text-green-400' : (score >= 6 ? 'text-yellow-400' : 'text-red-400');
    const imgBase = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/";

    const tooltipText = reasons?.length > 0 
        ? reasons.join(' | ') 
        : "Análisis de baneo estratégico";

    const borderColor = isBan ? 'border-red-900/30' : 'border-blue-900/30';
    const hoverColor = isBan ? 'hover:border-red-500' : 'hover:border-blue-500';

    return (
        <div 
        className={`recommendation-item group relative w-20 h-20 bg-slate-900 border ${borderColor} rounded-md ${hoverColor} cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95`}
        title={tooltipText}
        >
        <img 
            src={`${imgBase}${id}.png`} 
            className="w-full h-full object-cover rounded-md group-hover:opacity-20 transition-opacity" 
            alt={name}
            loading="lazy"
        />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <span className={`text-[13px] font-black px-2 py-1 rounded-full border border-slate-900 bg-slate-800 ${scoreColor} shadow-lg shadow-black/80`}>
            {score.toFixed(1)}
            </span>
        </div>
        </div>
    );
};