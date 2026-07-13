import React from 'react';
import type { ToastState } from './types';

interface SyncToastProps {
  toast: ToastState;
}

export const SyncToast = ({ toast }: SyncToastProps) => {
  if (!toast.visible) return null;

  return (
    <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-top-4 slide-in-from-right-4 duration-300">
      <div className={`p-4 rounded-sm border ${
        toast.type === 'error' 
          ? 'bg-red-950/40 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
          : toast.type === 'warn' 
            ? 'bg-yellow-950/40 border-yellow-500/50 text-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.15)]' 
            : 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(144,85,255,0.15)]'
        } backdrop-blur-md max-w-sm`}>
        <h4 className="text-[10px] font-black uppercase tracking-wider">{toast.title}</h4>
        <p className="text-[9px] uppercase mt-1 tracking-wide font-bold">{toast.body}</p>
      </div>
    </div>
  );
};

export default SyncToast;
