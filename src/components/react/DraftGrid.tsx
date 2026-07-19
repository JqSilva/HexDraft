import React, { memo } from 'react';
import { RecommendationCard } from './RecommendationCard';

interface DraftGridProps {
    recommendations: any[];
    onSelectChampion: (rec: any) => void;
    isBan?: boolean;
}

export const DraftGrid = memo(({ recommendations, onSelectChampion, isBan = false }: DraftGridProps) => {
    if (!recommendations || recommendations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black">
                <span className="animate-pulse">Calculando recomendaciones de {isBan ? 'bloqueo' : 'selección'}...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-3 gap-y-5 pb-4 w-full justify-items-center justify-center animate-in zoom-in-95">
            {recommendations.map((rec) => (
                <div key={rec.id} onClick={() => onSelectChampion(rec)}>
                    <RecommendationCard {...rec} isBan={isBan} />
                </div>
            ))}
        </div>
    );
});

DraftGrid.displayName = 'DraftGrid';

export default DraftGrid;
