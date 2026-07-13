import React, { useEffect, useState } from 'react';
import { useAppMode } from './useAppMode';
import { useDbUpdate } from './useDbUpdate';

export const UpdatePopup = () => {
  const { isAdmin, loaded } = useAppMode();
  const {
    checking,
    needsUpdate,
    downloading,
    progress,
    message,
    error,
    localPatch,
    remotePatch,
    localVersion,
    remoteVersion,
    startUpdate
  } = useDbUpdate();

  const [visible, setVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Si ya cargó el modo, necesita actualizar, no está buscando y no fue omitido
    if (loaded && needsUpdate && !checking && !isDismissed) {
      queueMicrotask(() => setVisible(true));
    } else {
      queueMicrotask(() => setVisible(false));
    }
  }, [isAdmin, needsUpdate, checking, loaded, isDismissed]);

  // Listener para cuando termina la actualización con éxito
  useEffect(() => {
    const handleUpdateDone = () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setVisible(false);
        // Recargar la página después de desaparecer para aplicar los datos
        window.location.reload();
      }, 3000);
    };

    window.addEventListener('hexdraft-db-updated', handleUpdateDone);
    return () => window.removeEventListener('hexdraft-db-updated', handleUpdateDone);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setVisible(false);
  };

  if (!visible && !showSuccess) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050507]/90 text-slate-200">
      
      {/* Contenedor Principal Plano (Estilo Terminal) */}
      <div className="w-full max-w-md p-8 border border-purple-500/30 bg-[#0c0c10] shadow-[0_4px_30px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col items-center">
        
        {/* Adorno superior morado */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#9055ff]" />

        {/* Logo de HexDraft en el centro */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-16 h-16 flex items-center justify-center rounded-lg shadow-[0_0_20px_rgba(144,85,255,0.25)] bg-[#07070a] p-1">
            <img
              src="/favicon.svg"
              alt="HexDraft Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center">
            <span className="text-xl font-black uppercase tracking-[0.25em] text-white">
              Hex<span className="text-[#9055ff]">Draft</span>
            </span>
            <span className="block text-[8px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
              Análisis de Composición en Tiempo Real
            </span>
          </div>
        </div>

        {/* Cuerpo del Popup */}
        <div className="w-full text-center space-y-4 mb-6">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            {showSuccess ? '¡Actualización Completada!' : 'Actualización Detectada'}
          </h3>
          
          {showSuccess ? (
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-bold leading-relaxed">
              La base de datos local ha sido actualizada con éxito. Recargando la aplicación...
            </p>
          ) : downloading ? (
            <p className="text-[11px] text-purple-400 uppercase tracking-wide font-bold leading-relaxed animate-pulse">
              {message}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11.5px] text-slate-400 uppercase tracking-wide font-bold leading-relaxed">
                Hay una nueva versión de la base de datos disponible para mejorar la precisión táctica.
              </p>
              
              {/* Caja de Datos de Versión */}
              <div className="bg-slate-950/40 border border-slate-900 px-4 py-3 font-mono text-[10px] text-slate-300 uppercase space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Parche Remoto:</span>
                  <span className="font-bold text-white">{remotePatch} (v{remoteVersion})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parche Local:</span>
                  <span className="font-bold text-slate-400">{localPatch} (v{localVersion})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Zona de Progreso / Botones */}
        <div className="w-full">
          {downloading ? (
            <div className="flex flex-col gap-2.5">
              <div className="w-full bg-slate-950 border border-purple-500/20 h-3 rounded-none overflow-hidden relative">
                <div 
                  className="bg-[#9055ff] h-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono font-bold text-purple-400 uppercase">
                <span>Instalando...</span>
                <span>{progress}%</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-3">
              <p className="text-[9.5px] text-red-400 font-bold uppercase tracking-wider text-center">
                Error de descarga: {error}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[10px] uppercase tracking-widest font-black transition-all duration-200 rounded-none cursor-pointer"
                >
                  Omitir
                </button>
                <button 
                  onClick={startUpdate}
                  className="flex-1 py-2.5 bg-red-950/40 border border-red-500/50 hover:bg-red-900/40 text-red-200 text-[10px] uppercase tracking-widest font-black transition-all duration-200 rounded-none cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : showSuccess ? (
            <div className="w-full py-2.5 bg-[#0e1c14] border border-emerald-500/30 text-emerald-400 text-[10px] uppercase tracking-widest font-black text-center">
              Listo
            </div>
          ) : (
            <div className="flex gap-3.5">
              <button 
                onClick={handleDismiss}
                className="flex-1 py-3 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[10px] uppercase tracking-widest font-black transition-all duration-200 rounded-none cursor-pointer"
              >
                Omitir
              </button>
              <button 
                onClick={startUpdate}
                className="flex-1 py-3 bg-[#1d1233] border border-purple-500/40 hover:border-purple-500 text-purple-300 hover:text-white text-[10px] uppercase tracking-widest font-black transition-all duration-200 rounded-none cursor-pointer shadow-[0_0_15px_rgba(144,85,255,0.1)]"
              >
                Actualizar
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
