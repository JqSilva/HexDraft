// src/components/react/AppUpdatePopup.tsx
import React, { useEffect, useState } from 'react';

interface AppVersionResponse {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseName?: string;
}

export const AppUpdatePopup = () => {
  const [updateInfo, setUpdateInfo] = useState<AppVersionResponse | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAppVersion = async () => {
      try {
        const res = await fetch('/api/app-version');
        if (!res.ok) return;
        const data: AppVersionResponse = await res.json();
        console.log('[AppUpdatePopup] Comprobación de versión de HexDraft:', data);
        
        if (data.hasUpdate && data.latestVersion) {
          const dismissKey = `hexdraft_app_update_dismissed_${data.latestVersion}`;
          if (sessionStorage.getItem(dismissKey) === 'true') {
            setDismissed(true);
            return;
          }
          setUpdateInfo(data);
        }
      } catch (e) {
        console.error('[AppUpdatePopup] Error al comprobar la versión de HexDraft:', e);
      }
    };

    // Retardo sutil de 2 segundos al arrancar
    const timer = setTimeout(checkAppVersion, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined' && updateInfo?.latestVersion) {
      sessionStorage.setItem(`hexdraft_app_update_dismissed_${updateInfo.latestVersion}`, 'true');
    }
  };

  const handleOpenRelease = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://github.com/JqSilva/HexDraft-Launcher/releases/latest', '_blank', 'noopener,noreferrer');
    }
  };

  if (dismissed || !updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 z-[9998] max-w-sm">
      <div className="bg-[#0b0b0f] border border-purple-500/40 text-slate-200 rounded-sm p-4 shadow-2xl relative overflow-hidden flex flex-col gap-3">
        {/* Adorno indicador superior */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-accent" />

        {/* Cabecera sutil */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-accent shrink-0" />
            <span className="text-[10px] text-purple-accent font-black uppercase tracking-wider">
              Actualización del Programa
            </span>
          </div>
          <button
            onClick={handleDismiss}
            title="Cerrar aviso"
            className="text-slate-500 hover:text-white transition-colors duration-200 text-xs font-bold leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mensaje principal */}
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-wide">
            HexDraft {updateInfo.latestVersion ? `v${updateInfo.latestVersion}` : 'Disponible'}
          </h4>
          <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
            Hay una nueva versión disponible en GitHub. (Actual: v{updateInfo.currentVersion})
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[9px] uppercase tracking-wider font-bold transition-all duration-200 rounded-sm cursor-pointer"
          >
            Omitir
          </button>
          <button
            onClick={handleOpenRelease}
            className="px-3 py-1.5 bg-[#1d1233] border border-purple-500/40 hover:border-purple-500 text-purple-200 hover:text-white text-[9px] uppercase tracking-wider font-black transition-all duration-200 rounded-sm cursor-pointer flex items-center gap-1 shadow-md"
          >
            <span>Descargar en GitHub</span>
            <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5m0-4.5L10.5 13.5M6 10.5V18a1.5 1.5 0 001.5 1.5h7.5A1.5 1.5 0 0016.5 18v-3.75" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
