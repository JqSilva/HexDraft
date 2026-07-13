import React, { memo } from 'react';

interface DraftSettingsProps {
    autoPick: boolean;
    setAutoPick: (val: boolean) => void;
    autoBan: boolean;
    setAutoBan: (val: boolean) => void;
}

export const DraftSettings = memo(({ autoPick, setAutoPick, autoBan, setAutoBan }: DraftSettingsProps) => {
    return (
        <div className="flex justify-center gap-12 mt-4 z-50 pt-3 border-t border-border-warm/50 shrink-0">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                    type="checkbox"
                    checked={autoPick}
                    onChange={(e) => setAutoPick(e.target.checked)}
                    className="hidden peer"
                />
                <div className="w-5 h-5 border border-border-warm rounded-sm bg-input-warm peer-checked:bg-purple-accent peer-checked:border-purple-accent transition-all duration-200 flex items-center justify-center">
                    <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors duration-200">
                    Autopick
                </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                    type="checkbox"
                    checked={autoBan}
                    onChange={(e) => setAutoBan(e.target.checked)}
                    className="hidden peer"
                />
                <div className="w-5 h-5 border border-border-warm rounded-sm bg-input-warm peer-checked:bg-[#ff4655] peer-checked:border-[#ff4655] transition-all duration-200 flex items-center justify-center">
                    <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors duration-200">
                    Autoban
                </span>
            </label>
        </div>
    );
});

DraftSettings.displayName = 'DraftSettings';

export default DraftSettings;
