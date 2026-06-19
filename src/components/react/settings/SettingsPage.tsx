// src/components/react/settings/SettingsPage.tsx
import React, { useState, useEffect } from 'react';

export const SettingsPage = () => {
    // --- ESTADOS DE CONFIGURACIÓN ---
    const [lolPath, setLolPath] = useState<string>('');
    const [autoPick, setAutoPick] = useState<boolean>(false);
    const [autoBan, setAutoBan] = useState<boolean>(false);
    const [autoExecuteSeconds, setAutoExecuteSeconds] = useState<number>(3.5);
    const [puppeteerConcurrency, setPuppeteerConcurrency] = useState<number>(3);
    const [syncPeriodDays, setSyncPeriodDays] = useState<number>(3);
    const [laneSyncPeriodDays, setLaneSyncPeriodDays] = useState<number>(21);
    const [engineWeights, setEngineWeights] = useState<any>({
        meta_base: 0.4,
        synergy: 2.2,
        matchup: 0.45,
        counter: 0.35,
        composition: 0.8,
        utility: 0.5,
        scaling: 1.0
    });

    // --- ESTADOS DE PÁGINA ---
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

    // --- CARGAR CONFIGURACIONES INICIALES ---
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const data = await res.json();
                    setLolPath(data.lol_path);
                    setAutoPick(data.auto_pick);
                    setAutoBan(data.auto_ban);
                    setAutoExecuteSeconds(data.auto_execute_seconds);
                    setPuppeteerConcurrency(data.puppeteer_concurrency);
                    setSyncPeriodDays(data.sync_period_days || 3);
                    setLaneSyncPeriodDays(data.lane_sync_period_days || 21);
                    if (data.engine_weights && Object.keys(data.engine_weights).length > 0) {
                        setEngineWeights(data.engine_weights);
                    }
                }
            } catch (e) {
                console.error("Error cargando configuraciones:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchConfigs();
    }, []);

    // --- GUARDAR AJUSTES ---
    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setSaveSuccess(false);

        const formData = new FormData(e.currentTarget);
        const lolPathVal = formData.get('lolPath') as string;
        
        const weights: Record<string, number> = {};
        Object.keys(engineWeights).forEach((key) => {
            const val = formData.get(`weight_${key}`);
            weights[key] = parseFloat(val as string) || 0;
        });

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lol_path: lolPathVal,
                    auto_pick: autoPick,
                    auto_ban: autoBan,
                    auto_execute_seconds: autoExecuteSeconds,
                    puppeteer_concurrency: puppeteerConcurrency,
                    sync_period_days: syncPeriodDays,
                    lane_sync_period_days: laneSyncPeriodDays,
                    engine_weights: weights
                })
            });

            if (res.ok) {
                setLolPath(lolPathVal);
                setEngineWeights(weights);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                alert("Error al guardar las configuraciones.");
            }
        } catch (error) {
            console.error("Error al guardar ajustes:", error);
            alert("Error al conectar con la API de configuración.");
        } finally {
            setSaving(false);
        }
    };

    const getConcurrencyMessage = () => {
        if (puppeteerConcurrency <= 2) return { text: "Seguro y estable. Ideal para conexiones o proxies sencillos.", color: "text-slate-500" };
        if (puppeteerConcurrency <= 4) return { text: "Balanceado. Súper rápido. Opción recomendada para FlareSolverr.", color: "text-purple-400" };
        return { text: "Extremo. Sincronización ultra-rápida. Requiere buena capacidad en tu FlareSolverr local.", color: "text-red-500 font-bold" };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-300">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#9055ff] mb-4"></div>
                <p className="uppercase tracking-[0.2em] text-[10px] font-bold">Cargando Ajustes...</p>
            </div>
        );
    }

    const concurrencyMsg = getConcurrencyMessage();

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 w-full text-slate-200 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleSave} className="w-full flex flex-col gap-6">
                
                {/* Cabecera sin fondo de tarjeta */}
                <header className="border-b border-border-warm/30 pb-5">
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-[0.2em] text-white">
                        Panel de <span className="text-[#9055ff]">Ajustes</span>
                    </h1>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-extrabold mt-1">
                        Configuración del motor HexDraft & Automatización
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Columna Izquierda: Integración y Rendimiento (8 col) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        
                        {/* Tarjeta 1: Integración con League & LCU */}
                        <div className="bg-[#0c0c10] border border-border-warm/40 p-6 rounded-sm tech-corners shadow-xl flex flex-col gap-6">
                            <div>
                                <h3 className="text-sm text-[#9055ff] font-black uppercase tracking-[0.2em] italic mb-1">
                                    Integración del Cliente (LCU)
                                </h3>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">
                                    Enlace activo con el juego y automatización
                                </p>
                            </div>

                            {/* Ruta de LoL */}
                            <div className="space-y-2.5">
                                <label className="block text-[10px] uppercase font-black tracking-widest text-slate-300">Ruta de League of Legends</label>
                                <input 
                                    type="text" 
                                    name="lolPath"
                                    defaultValue={lolPath} 
                                    placeholder="C:\Riot Games\League of Legends\lockfile" 
                                    className="w-full bg-[#111117] border border-[#23232c] focus:border-[#9055ff]/80 text-[11px] font-mono text-slate-200 rounded-sm px-4 py-3 transition-colors focus:outline-none"
                                />
                                <p className="text-[9px] text-slate-500 font-medium leading-relaxed uppercase tracking-wide">
                                    Indica la ruta absoluta hacia el archivo <code className="text-white lowercase">lockfile</code> de Riot Games para habilitar la lectura de fases en vivo.
                                </p>
                            </div>

                            {/* Toggles de Auto-Pick / Auto-Ban */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="flex items-center justify-between p-4 bg-black/20 border border-[#23232c] rounded-sm hover:border-[#9055ff]/30 transition-all duration-300">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Auto-Pick</span>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">Fija automáticamente el recomendado</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={autoPick} 
                                        onChange={(e) => setAutoPick(e.target.checked)}
                                        className="w-4.5 h-4.5 text-[#9055ff] border-[#23232c] bg-[#111117] focus:ring-0 rounded cursor-pointer transition-colors"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-black/20 border border-[#23232c] rounded-sm hover:border-[#9055ff]/30 transition-all duration-300">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Auto-Ban</span>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">Banea automáticamente la sugerencia</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={autoBan} 
                                        onChange={(e) => setAutoBan(e.target.checked)}
                                        className="w-4.5 h-4.5 text-[#9055ff] border-[#23232c] bg-[#111117] focus:ring-0 rounded cursor-pointer transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta 2: Tiempos y Concurrencia */}
                        <div className="bg-[#0c0c10] border border-border-warm/40 p-6 rounded-sm tech-corners shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Segundos de autoejecución */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                    <label className="text-[#9055ff] tracking-widest">Auto-Acción a falta de</label>
                                    <span className="font-mono text-white bg-[#1a1a24] px-2.5 py-0.5 rounded-sm">{autoExecuteSeconds}s</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    step="0.5" 
                                    value={autoExecuteSeconds} 
                                    onChange={(e) => setAutoExecuteSeconds(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#1a1a24] rounded-lg appearance-none cursor-pointer accent-[#9055ff]"
                                />
                                <p className="text-[9px] text-slate-500 font-medium tracking-wide leading-relaxed uppercase">
                                    Tiempo restante en la fase para que el bot tome control.
                                </p>
                            </div>

                            {/* Concurrencia de Scraper */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                    <label className="text-[#9055ff] tracking-widest">Hilos simultáneos (FlareSolverr)</label>
                                    <span className="font-mono text-white bg-[#1a1a24] px-2.5 py-0.5 rounded-sm">{puppeteerConcurrency}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="6" 
                                    step="1" 
                                    value={puppeteerConcurrency} 
                                    onChange={(e) => setPuppeteerConcurrency(parseInt(e.target.value))}
                                    className="w-full h-1 bg-[#1a1a24] rounded-lg appearance-none cursor-pointer accent-[#9055ff]"
                                />
                                <p className={`text-[9px] font-medium tracking-wide leading-relaxed uppercase ${concurrencyMsg.color}`}>
                                    {concurrencyMsg.text}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha: Periodicidad de Sincronización (4 col) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-[#0c0c10] border border-border-warm/40 p-6 rounded-sm tech-corners shadow-xl flex-1 flex flex-col justify-between gap-6">
                            <div>
                                <h3 className="text-sm text-[#9055ff] font-black uppercase tracking-[0.2em] italic mb-1">
                                    Sincronización
                                </h3>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">
                                    Intervalos de actualización del meta
                                </p>
                            </div>

                            <div className="space-y-4 flex-1 flex flex-col justify-center">
                                <div className="space-y-2">
                                    <span className="block text-[10px] uppercase font-bold text-slate-300 tracking-wider">Meta & Builds</span>
                                    <select 
                                        value={syncPeriodDays}
                                        onChange={(e) => setSyncPeriodDays(parseInt(e.target.value))}
                                        className="w-full bg-[#111117] border border-[#23232c] text-xs font-bold text-white p-3 rounded-sm focus:outline-none focus:border-[#9055ff]/80 cursor-pointer"
                                    >
                                        <option value={1}>Cada 1 día</option>
                                        <option value={3}>Cada 3 días (Recomendado)</option>
                                        <option value={5}>Cada 5 días</option>
                                        <option value={7}>Cada 7 días (1 semana)</option>
                                        <option value={15}>Cada 15 días</option>
                                    </select>
                                    <span className="block text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                                        Tiempo antes de obligar una recarga de builds al arrancar.
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <span className="block text-[10px] uppercase font-bold text-slate-300 tracking-wider">Mapeo de Posiciones (Lanes)</span>
                                    <select 
                                        value={laneSyncPeriodDays}
                                        onChange={(e) => setLaneSyncPeriodDays(parseInt(e.target.value))}
                                        className="w-full bg-[#111117] border border-[#23232c] text-xs font-bold text-white p-3 rounded-sm focus:outline-none focus:border-[#9055ff]/80 cursor-pointer"
                                    >
                                        <option value={15}>Cada 15 días</option>
                                        <option value={21}>Cada 21 días (3 semanas)</option>
                                        <option value={30}>Cada 30 días (1 mes - Recomendado)</option>
                                        <option value={60}>Cada 60 días (2 meses)</option>
                                    </select>
                                    <span className="block text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                                        Tiempo antes de forzar el mapeo de carriles preferidos.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tarjeta 4: Coeficientes del Motor de Recomendación */}
                <div className="bg-[#0c0c10] border border-border-warm/40 p-6 rounded-sm tech-corners shadow-2xl relative overflow-hidden mt-2">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-[#9055ff]/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="mb-6">
                        <h3 className="text-sm text-cyan-400 font-black uppercase tracking-[0.2em] italic mb-1">
                            Coeficientes del Motor de Recomendación
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">
                            Pesos relativos asignados a cada factor de evaluación algorítmica
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(engineWeights).map(([key, val]: [string, any]) => (
                            <div key={key} className="bg-[#111117] border border-[#23232c] p-4 rounded-sm hover:border-cyan-500/30 transition-all duration-300 group">
                                <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-mono mb-2 group-hover:text-cyan-400 transition-colors">
                                    {key.replace('_', ' ')}
                                </span>
                                <input 
                                    type="number" 
                                    step="0.05"
                                    min="0"
                                    name={`weight_${key}`}
                                    defaultValue={val}
                                    className="w-full bg-[#0a0a0d] border border-[#23232c] focus:border-cyan-500/80 text-xs font-mono font-bold text-white px-3 py-2 rounded-sm focus:outline-none transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Botón Guardar en contenedor transparente */}
                <div className="flex justify-end mt-4 pt-4 border-t border-border-warm/30">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className={`px-8 py-3.5 rounded-sm text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all duration-300 active:scale-95 ${
                            saveSuccess 
                            ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]'
                            : 'bg-[#9055ff] hover:bg-[#a26eff] text-white shadow-[0_0_15px_rgba(144,85,255,0.3)]'
                        }`}
                    >
                        {saving ? 'Guardando...' : (saveSuccess ? '✓ Ajustes Guardados' : 'Guardar Ajustes')}
                    </button>
                </div>
            </form>
        </div>
    );
};
