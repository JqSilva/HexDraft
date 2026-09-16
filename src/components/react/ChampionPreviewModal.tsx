import React, { memo } from 'react';

interface ChampionPreviewModalProps {
    previewChamp: any;
    onClose: () => void;
}

export const ChampionPreviewModal = memo(({ previewChamp, onClose }: ChampionPreviewModalProps) => {
    if (!previewChamp) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md p-6 bg-panel-warm border border-border-warm rounded-xl relative animate-in zoom-in-95 duration-150 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold transition-colors duration-200 uppercase text-[10px] tracking-widest cursor-pointer"
                >
                    ✕ Cerrar
                </button>

                <div className="mb-6">
                    <span className="text-xs text-purple-accent font-medium tracking-wide">Evaluación del motor</span>
                    <h3 className="text-xl font-semibold text-white tracking-tight mt-1">
                        {previewChamp.name}
                    </h3>
                    <div className="h-px bg-border-warm w-full mt-3"></div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {previewChamp.reasons?.map((reason: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-slate-300 bg-input-warm/40 border border-border-warm/50 p-3 rounded-lg">
                            <span className="text-purple-accent font-bold mt-0.5 text-[10px]">◆</span>
                            <p className="leading-relaxed">{reason}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border-warm flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">Puntuación proyectada</span>
                    <span className="text-sm font-semibold px-2.5 py-1 bg-purple-accent/10 border border-purple-accent/20 text-purple-accent rounded-md">
                        {previewChamp.score?.toFixed(1)} / 10
                    </span>
                </div>
            </div>
        </div>
    );
});

ChampionPreviewModal.displayName = 'ChampionPreviewModal';

export default ChampionPreviewModal;
