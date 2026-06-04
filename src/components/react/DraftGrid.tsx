import React, { memo } from 'react';
import { RecommendationCard } from './RecommendationCard';

interface DraftGridProps {
    recommendations: any[];
    onSelectChampion: (rec: any) => void;
    isBan?: boolean;
}

export const DraftGrid = memo(({ recommendations, onSelectChampion, isBan = false }: DraftGridProps) => {
    return (
        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-4 pb-4 max-w-fit w-full mx-auto animate-in zoom-in-95">
            {recommendations.map((rec) => (
                <div key={rec.id} onClick={() => onSelectChampion(rec)}>
                    <RecommendationCard {...rec} isBan={isBan} />
                </div>
            ))}
        </div>
    );
});

export default DraftGrid;
