import React, { memo } from 'react';

export const DraftLobby = memo(() => {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className="relative w-20 h-20 mb-8">
                <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <style>{`
                        @keyframes hf1 { 0%,100%{opacity:.12} 8%{opacity:1} 20%{opacity:.12} }
                        @keyframes hf2 { 0%,100%{opacity:.12} 16%{opacity:.12} 24%{opacity:1} 36%{opacity:.12} }
                        @keyframes hf3 { 0%,100%{opacity:.12} 32%{opacity:.12} 40%{opacity:1} 52%{opacity:.12} }
                        @keyframes hf4 { 0%,100%{opacity:.12} 48%{opacity:.12} 56%{opacity:1} 68%{opacity:.12} }
                        @keyframes hf5 { 0%,100%{opacity:.12} 64%{opacity:.12} 72%{opacity:1} 84%{opacity:.12} }
                        @keyframes hf6 { 0%,100%{opacity:.12} 80%{opacity:.12} 88%{opacity:1} 100%{opacity:.12} }
                        .hf1 { animation: hf1 3.6s ease-in-out infinite; }
                        .hf2 { animation: hf2 3.6s ease-in-out infinite; }
                        .hf3 { animation: hf3 3.6s ease-in-out infinite; }
                        .hf4 { animation: hf4 3.6s ease-in-out infinite; }
                        .hf5 { animation: hf5 3.6s ease-in-out infinite; }
                        .hf6 { animation: hf6 3.6s ease-in-out infinite; }
                    `}</style>
                    <line x1="50" y1="50" x2="50" y2="8" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="50" x2="86.4" y2="29" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="50" x2="86.4" y2="71" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="50" x2="50" y2="92" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="50" x2="13.6" y2="71" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="50" x2="13.6" y2="29" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                    <line x1="50" y1="8" x2="86.4" y2="29" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="86.4" y1="29" x2="86.4" y2="71" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="86.4" y1="71" x2="50" y2="92" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="50" y1="92" x2="13.6" y2="71" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="13.6" y1="71" x2="13.6" y2="29" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="13.6" y1="29" x2="50" y2="8" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="50" y1="8" x2="86.4" y2="29" className="hf1" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="86.4" y1="29" x2="86.4" y2="71" className="hf2" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="86.4" y1="71" x2="50" y2="92" className="hf3" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="50" y1="92" x2="13.6" y2="71" className="hf4" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="13.6" y1="71" x2="13.6" y2="29" className="hf5" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                    <line x1="13.6" y1="29" x2="50" y2="8" className="hf6" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
            </div>
            <p className="text-slate-400 uppercase font-black tracking-[0.3em] text-xs animate-pulse">Esperando Selección...</p>
        </div>
    );
});

export default DraftLobby;
