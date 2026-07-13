import React, { memo } from 'react';

interface ConnectionStatusProps {
    isConnected: boolean;
}

export const ConnectionStatus = memo(({ isConnected }: ConnectionStatusProps) => {
    return (
        <div className="w-fit mx-auto mt-2 flex items-center gap-3 py-2 px-4 bg-panel-warm border border-border-warm rounded-sm relative z-10 select-none">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400">
                {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
        </div>
    );
});

ConnectionStatus.displayName = 'ConnectionStatus';

export default ConnectionStatus;
