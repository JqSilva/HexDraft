import React, { memo } from 'react';
import { RecommendationCard } from './RecommendationCard';

interface DraftGridProps {
    recommendations: any[];
    onSelectChampion: (rec: any) => void;
    isBan?: boolean;
}

export const DraftGrid = memo(({ recommendations, onSelectChampion, isBan = false }: DraftGridProps) => {
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-3 gap-y-5 pb-4 w-full justify-items-center justify-center animate-in zoom-in-95">
            {recommendations.map((rec) => (
                <div key={rec.id} onClick={() => onSelectChampion(rec)}>
                    <RecommendationCard {...rec} isBan={isBan} />
                </div>
            ))}
        </div>
    );
});

export default DraftGrid;
