// src/components/react/settings/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAppMode } from '../useAppMode';
import { APP_VERSION } from '../../../config/version';

export const SettingsPage = () => {
    const { isAdmin, loaded: modeLoaded } = useAppMode();
    // --- ESTADOS DE CONFIGURACIÓN ---
    const [lolPath, setLolPath] = useState<string>('');
    const [autoPick, setAutoPick] = useState<boolean>(false);
    const [autoBan, setAutoBan] = useState<boolean>(false);
    const [autoExecuteSeconds, setAutoExecuteSeconds] = useState<number>(3.5);
    const [autoAcceptEnabled, setAutoAcceptEnabled] = useState<boolean>(false);
    const [autoAcceptDelayPct, setAutoAcceptDelayPct] = useState<number>(80);
    const [puppeteerConcurrency, setPuppeteerConcurrency] = useState<number>(3);
    const [syncPeriodDays, setSyncPeriodDays] = useState<number>(3);
    const [laneSyncPeriodDays, setLaneSyncPeriodDays] = useState<number>(21);
    const [metaSyncFrequency, setMetaSyncFrequency] = useState<number>(2);
    const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState<boolean>(false);
    const [telegramBotToken, setTelegramBotToken] = useState<string>('');
    const [telegramChatId, setTelegramChatId] = useState<string>('');
    const [telegramDeduplicateEnabled, setTelegramDeduplicateEnabled] = useState<boolean>(true);
    const [testSending, setTestSending] = useState<boolean>(false);
    const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
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
                    setAutoAcceptEnabled(data.auto_accept_enabled);
                    setAutoAcceptDelayPct(data.auto_accept_delay_pct || 80);
                    setPuppeteerConcurrency(data.puppeteer_concurrency);
                    setSyncPeriodDays(data.sync_period_days || 3);
                    setLaneSyncPeriodDays(data.lane_sync_period_days || 21);
                    setMetaSyncFrequency(data.meta_sync_frequency !== undefined ? data.meta_sync_frequency : 2);
                    setTelegramNotificationsEnabled(data.telegram_notifications_enabled);
                    setTelegramBotToken(data.telegram_bot_token || '');
                    setTelegramChatId(data.telegram_chat_id || '');
                    setTelegramDeduplicateEnabled(data.telegram_deduplicate_enabled !== false);
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
            weights[key] = val !== null ? parseFloat(val as string) || 0 : engineWeights[key];
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
                    auto_accept_enabled: autoAcceptEnabled,
                    auto_accept_delay_pct: autoAcceptDelayPct,
                    telegram_notifications_enabled: telegramNotificationsEnabled,
                    telegram_bot_token: telegramBotToken,
                    telegram_chat_id: telegramChatId,
                    telegram_deduplicate_enabled: telegramDeduplicateEnabled,
                    puppeteer_concurrency: puppeteerConcurrency,
                    sync_period_days: syncPeriodDays,
                    lane_sync_period_days: laneSyncPeriodDays,
                    meta_sync_frequency: metaSyncFrequency,
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

    const handleTestTelegram = async () => {
        setTestSending(true);
        setTestSuccess(null);
        try {
            const res = await fetch('/api/telegram-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: '¡Conexión de prueba con HexDraft establecida con éxito! ⚡' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setTestSuccess(true);
                setTimeout(() => setTestSuccess(null), 3000);
            } else {
                setTestSuccess(false);
                alert(`Error al enviar mensaje: ${data.error || 'Respuesta no satisfactoria'}`);
            }
        } catch (e) {
            console.error(e);
            setTestSuccess(false);
            alert("Error al conectar con la API de notificaciones.");
        } finally {
            setTestSending(false);
        }
    };

    const getConcurrencyMessage = () => {
        if (puppeteerConcurrency <= 2) return { text: "Seguro y estable. Ideal para conexiones sencillas.", color: "text-slate-500 font-mono text-[9px]" };
        if (puppeteerConcurrency <= 4) return { text: "Balanceado. Súper rápido. Recomendado para FlareSolverr.", color: "text-purple-400 font-mono text-[9px]" };
        return { text: "Extremo. Requiere alta capacidad en tu FlareSolverr local.", color: "text-red-500 font-bold font-mono text-[9px]" };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-300">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-accent border-t-transparent mb-4"></div>
                <p className="uppercase tracking-[0.3em] text-[9px] font-black text-slate-500">Cargando Ajustes...</p>
            </div>
        );
    }

    const concurrencyMsg = getConcurrencyMessage();

    return (
        <div className="w-full flex flex-col p-4 md:p-6 text-slate-200 animate-in fade-in duration-300">
            <form onSubmit={handleSave} className="w-full flex flex-col">

                {/* Cabecera Táctica (Ocupa todo el ancho) */}
                <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4 mb-6">
                    <div>
                        <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 block mb-1">
                            SISTEMA // PANEL DE CONFIGURACIÓN GLOBAL
                        </span>
                        <h1 className="text-xl font-black text-white uppercase tracking-tight">
                            Panel de <span className="text-purple-accent">Ajustes</span>
                        </h1>
                    </div>
                    <div className="flex flex-row gap-4 text-[12px] text-slate-400 uppercase tracking-widest font-mono select-none">
                        <div>VERSION APP: <span className="text-[#9055ff] font-bold text-right">{APP_VERSION}  </span></div>

                    </div>
                </header>

                {/* Contenido Principal Centrado */}
                <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        {/* Columna Izquierda: Integración y Rendimiento (8 col o 12 col si no es admin) */}
                        <div className={isAdmin ? "lg:col-span-8 flex flex-col gap-6" : "lg:col-span-12 flex flex-col gap-6"}>

                            {/* Tarjeta 1: Integración con League & LCU */}
                            <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl relative overflow-hidden flex flex-col gap-6">
                                <div className="absolute top-0 right-0 h-32 w-32 bg-purple-accent/5 rounded-full blur-3xl pointer-events-none" />

                                <div>
                                    <h3 className="text-xs text-purple-accent font-black uppercase tracking-[0.2em] italic mb-1">
                                        Integración del Cliente (LCU)
                                    </h3>
                                    <p className="text-[9.5px] text-slate-500 uppercase tracking-widest font-extrabold">
                                        Enlace activo con el juego y automatización
                                    </p>
                                </div>

                                {/* Ruta de LoL */}
                                <div className="space-y-2.5">
                                    <label className="block text-[9.5px] uppercase font-black tracking-widest text-slate-300">
                                        Ruta de League of Legends
                                    </label>
                                    <input
                                        type="text"
                                        name="lolPath"
                                        defaultValue={lolPath}
                                        placeholder="C:\Riot Games\League of Legends\lockfile"
                                        className="w-full bg-[#060608]/90 border border-border-warm focus:border-purple-accent text-xs font-mono text-slate-200 rounded-sm px-4 py-3 transition-all focus:outline-none focus:ring-1 focus:ring-purple-accent/20"
                                    />
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                                        Indica la ruta absoluta hacia el archivo <code className="text-white lowercase font-mono">lockfile</code> de Riot Games para habilitar la lectura de fases en vivo.
                                    </p>
                                </div>

                                {/* Toggles de Auto-Pick / Auto-Ban */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <label className={`flex items-center justify-between p-4 rounded-sm border cursor-pointer select-none transition-all duration-200 active:scale-[0.99]
                                        ${autoPick
                                            ? 'bg-purple-accent/5 border-purple-accent/50 shadow-[0_0_15px_rgba(144,85,255,0.05)]'
                                            : 'bg-black/20 border-border-warm hover:border-slate-800'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Auto-Pick</span>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-extrabold mt-0.5">Fija automáticamente el recomendado</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoPick}
                                            onChange={(e) => setAutoPick(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${autoPick ? 'bg-purple-accent' : 'bg-slate-800'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${autoPick ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </label>

                                    <label className={`flex items-center justify-between p-4 rounded-sm border cursor-pointer select-none transition-all duration-200 active:scale-[0.99]
                                        ${autoBan
                                            ? 'bg-purple-accent/5 border-purple-accent/50 shadow-[0_0_15px_rgba(144,85,255,0.05)]'
                                            : 'bg-black/20 border-border-warm hover:border-slate-800'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Auto-Ban</span>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-extrabold mt-0.5">Banea automáticamente la sugerencia</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoBan}
                                            onChange={(e) => setAutoBan(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${autoBan ? 'bg-purple-accent' : 'bg-slate-800'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${autoBan ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </label>
                                </div>

                                {/* Tiempo de Bloqueo Automático (Auto-Pick / Auto-Ban) */}
                                {(autoPick || autoBan) && (
                                    <div className="border-t border-border-warm/50 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Tiempo de Bloqueo Automático</span>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-extrabold mt-0.5">Segundos restantes en el reloj para fijar pick/ban</span>
                                        </div>
                                        <div className="w-full sm:w-1/2 space-y-3 px-2">
                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                <label className="text-purple-accent tracking-widest font-black">Segundos restantes</label>
                                                <span className="font-mono text-xs font-bold text-white bg-black/40 border border-border-warm px-2 py-0.5 rounded-sm">{autoExecuteSeconds}s</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1.0"
                                                max="6.0"
                                                step="0.5"
                                                value={autoExecuteSeconds}
                                                onChange={(e) => setAutoExecuteSeconds(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-[#15151e] rounded-sm appearance-none cursor-pointer accent-purple-accent"
                                            />
                                            <p className="text-[9px] text-slate-500 font-bold tracking-wider leading-relaxed uppercase">
                                                Margen de tiempo antes de finalizar tu turno para enviar la acción al LCU (1.0s a 6.0s). Por defecto 3.5s.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Auto-Aceptar Partida */}
                                <div className="border-t border-border-warm/50 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                    <label className={`flex items-center justify-between p-4 rounded-sm border cursor-pointer select-none transition-all duration-200 active:scale-[0.99] w-full sm:w-1/2
                                        ${autoAcceptEnabled
                                            ? 'bg-purple-accent/5 border-purple-accent/50 shadow-[0_0_15px_rgba(144,85,255,0.05)]'
                                            : 'bg-black/20 border-border-warm hover:border-slate-800'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Auto-Aceptar Partida</span>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-extrabold mt-0.5">Acepta la partida automáticamente al encontrarla</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoAcceptEnabled}
                                            onChange={(e) => setAutoAcceptEnabled(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${autoAcceptEnabled ? 'bg-purple-accent' : 'bg-slate-800'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${autoAcceptEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </label>

                                    {autoAcceptEnabled && (
                                        <div className="w-full sm:w-1/2 space-y-3 px-2">
                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                <label className="text-purple-accent tracking-widest font-black">Delay de aceptación</label>
                                                <span className="font-mono text-xs font-bold text-white bg-black/40 border border-border-warm px-2 py-0.5 rounded-sm">{autoAcceptDelayPct}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="95"
                                                step="5"
                                                value={autoAcceptDelayPct}
                                                onChange={(e) => setAutoAcceptDelayPct(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-[#15151e] rounded-sm appearance-none cursor-pointer accent-purple-accent"
                                            />
                                            <p className="text-[9px] text-slate-500 font-bold tracking-wider leading-relaxed uppercase">
                                                Porcentaje del tiempo transcurrido del cartel de aceptación antes de dar click. Por defecto es 80%.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Notificaciones de Telegram */}
                                <div className="border-t border-border-warm/50 pt-6 flex flex-col gap-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Notificaciones de Telegram</span>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-extrabold mt-0.5">Recibe alertas en tu celular en tiempo real</span>
                                        </div>

                                        <label className={`flex items-center justify-between p-2 rounded-sm border cursor-pointer select-none transition-all duration-200 active:scale-[0.99]
                                            ${telegramNotificationsEnabled
                                                ? 'bg-purple-accent/5 border-purple-accent/50 shadow-[0_0_15px_rgba(144,85,255,0.05)]'
                                                : 'bg-black/20 border-border-warm hover:border-slate-800'}`}>
                                            <input
                                                type="checkbox"
                                                checked={telegramNotificationsEnabled}
                                                onChange={(e) => setTelegramNotificationsEnabled(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${telegramNotificationsEnabled ? 'bg-purple-accent' : 'bg-slate-800'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${telegramNotificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                        </label>
                                    </div>

                                    {telegramNotificationsEnabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                            <div className="space-y-2">
                                                <label className="block text-[9.5px] uppercase font-black tracking-widest text-slate-300">
                                                    Token del Bot de Telegram
                                                </label>
                                                <input
                                                    type="password"
                                                    value={telegramBotToken}
                                                    onChange={(e) => setTelegramBotToken(e.target.value)}
                                                    placeholder="123456789:ABCdefGh..."
                                                    className="w-full bg-[#060608]/90 border border-border-warm focus:border-purple-accent text-xs font-mono text-slate-200 rounded-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-purple-accent/20"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-[9.5px] uppercase font-black tracking-widest text-slate-300">
                                                    Chat ID de Telegram
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={telegramChatId}
                                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                                        placeholder="987654321"
                                                        className="w-full bg-[#060608]/90 border border-border-warm focus:border-purple-accent text-xs font-mono text-slate-200 rounded-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-purple-accent/20"
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={handleTestTelegram}
                                                        disabled={testSending || !telegramBotToken || !telegramChatId}
                                                        className="px-3 bg-black/40 border border-border-warm hover:border-purple-accent/50 text-slate-300 hover:text-white disabled:opacity-30 text-[9px] uppercase tracking-wider font-black transition-all rounded-sm cursor-pointer shrink-0"
                                                    >
                                                        {testSending ? 'Enviando...' : testSuccess ? '¡Enviado! ✓' : 'Probar'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 space-y-2 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9.5px] uppercase font-black tracking-widest text-slate-300">Evitar Notificaciones Duplicadas</span>
                                                        <span className="text-[8px] text-slate-500 uppercase tracking-wide font-bold mt-0.5">Filtra mensajes repetidos en un intervalo de 5 segundos</span>
                                                    </div>
                                                    <label className={`flex items-center justify-between p-1.5 rounded-sm border cursor-pointer select-none transition-all duration-200 active:scale-[0.99]
                                                        ${telegramDeduplicateEnabled
                                                            ? 'bg-purple-accent/5 border-purple-accent/50 shadow-[0_0_15px_rgba(144,85,255,0.05)]'
                                                            : 'bg-black/20 border-border-warm hover:border-slate-800'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={telegramDeduplicateEnabled}
                                                            onChange={(e) => setTelegramDeduplicateEnabled(e.target.checked)}
                                                            className="sr-only"
                                                        />
                                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${telegramDeduplicateEnabled ? 'bg-purple-accent' : 'bg-slate-800'}`}>
                                                            <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-md ${telegramDeduplicateEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tarjeta 2: Tiempos y Concurrencia */}
                            <div className={`bg-[#0b0b0f] border border-border-warm p-6 rounded-sm tech-corners shadow-2xl relative overflow-hidden ${isAdmin ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'flex flex-col gap-6'}`}>
                                <div className="absolute top-0 right-0 h-32 w-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                                {/* Segundos de autoejecución */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                        <label className="text-purple-accent tracking-widest font-black">Auto-Acción a falta de</label>
                                        <span className="font-mono text-xs font-bold text-white bg-black/40 border border-border-warm px-2 py-0.5 rounded-sm">{autoExecuteSeconds}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.5"
                                        value={autoExecuteSeconds}
                                        onChange={(e) => setAutoExecuteSeconds(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-[#15151e] rounded-sm appearance-none cursor-pointer accent-purple-accent"
                                    />
                                    <p className="text-[9px] text-slate-500 font-bold tracking-wider leading-relaxed uppercase">
                                        Tiempo restante en la fase para que el bot tome control.
                                    </p>
                                </div>

                                {/* Concurrencia de Scraper */}
                                {isAdmin && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                            <label className="text-purple-accent tracking-widest font-black">Hilos simultáneos (Scraper)</label>
                                            <span className="font-mono text-xs font-bold text-white bg-black/40 border border-border-warm px-2 py-0.5 rounded-sm">{puppeteerConcurrency}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="6"
                                            step="1"
                                            value={puppeteerConcurrency}
                                            onChange={(e) => setPuppeteerConcurrency(parseInt(e.target.value))}
                                            className="w-full h-1 bg-[#15151e] rounded-sm appearance-none cursor-pointer accent-purple-accent"
                                        />
                                        <p className={`uppercase tracking-wider leading-relaxed ${concurrencyMsg.color}`}>
                                            {concurrencyMsg.text}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Columna Derecha: Periodicidad de Sincronización (4 col) */}
                        {isAdmin && (
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-[#0b0b0f] border border-border-warm p-6 rounded-sm tech-corners shadow-2xl flex-1 flex flex-col justify-between gap-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 h-32 w-32 bg-purple-accent/5 rounded-full blur-3xl pointer-events-none" />

                                    <div>
                                        <h3 className="text-xs text-purple-accent font-black uppercase tracking-[0.2em] italic mb-1">
                                            Sincronización
                                        </h3>
                                        <p className="text-[9.5px] text-slate-500 uppercase tracking-widest font-extrabold">
                                            Intervalos de actualización del meta
                                        </p>
                                    </div>

                                    <div className="space-y-5 flex-1 flex flex-col justify-center">
                                        <div className="space-y-2">
                                            <span className="block text-[9.5px] uppercase font-black text-slate-300 tracking-wider">Meta & Builds</span>
                                            <select
                                                value={syncPeriodDays}
                                                onChange={(e) => setSyncPeriodDays(parseInt(e.target.value))}
                                                className="w-full bg-[#060608]/90 border border-border-warm text-xs font-bold text-white p-3 rounded-sm focus:outline-none focus:border-purple-accent cursor-pointer"
                                            >
                                                <option value={1}>Cada 1 día</option>
                                                <option value={3}>Cada 3 días (Recomendado)</option>
                                                <option value={5}>Cada 5 días</option>
                                                <option value={7}>Cada 7 días (1 semana)</option>
                                                <option value={15}>Cada 15 días</option>
                                            </select>
                                            <span className="block text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">
                                                Tiempo antes de obligar una recarga de builds al arrancar.
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="block text-[9.5px] uppercase font-black text-slate-300 tracking-wider">Mapeo de Posiciones (Lanes)</span>
                                            <select
                                                value={laneSyncPeriodDays}
                                                onChange={(e) => setLaneSyncPeriodDays(parseInt(e.target.value))}
                                                className="w-full bg-[#060608]/90 border border-border-warm text-xs font-bold text-white p-3 rounded-sm focus:outline-none focus:border-purple-accent cursor-pointer"
                                            >
                                                <option value={15}>Cada 15 días</option>
                                                <option value={21}>Cada 21 días (3 semanas)</option>
                                                <option value={30}>Cada 30 días (1 mes - Recomendado)</option>
                                                <option value={60}>Cada 60 días (2 meses)</option>
                                            </select>
                                            <span className="block text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">
                                                Tiempo antes de forzar el mapeo de carriles preferidos.
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="block text-[9.5px] uppercase font-black text-slate-300 tracking-wider font-sans">Frecuencia Sincronización Ligera</span>
                                            <select
                                                value={metaSyncFrequency}
                                                onChange={(e) => setMetaSyncFrequency(parseFloat(e.target.value))}
                                                className="w-full bg-[#060608]/90 border border-border-warm text-xs font-bold text-white p-3 rounded-sm focus:outline-none focus:border-purple-accent cursor-pointer"
                                            >
                                                <option value={0}>Desactivado</option>
                                                <option value={-1}>Al iniciar el programa</option>
                                                <option value={2}>Cada 2 horas</option>
                                                <option value={4}>Cada 4 horas</option>
                                                <option value={12}>Cada 12 horas</option>
                                                <option value={24}>Cada 24 horas</option>
                                            </select>
                                            <span className="block text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">
                                                Frecuencia de la sincronización ligera de tiers y estadísticas de OP.GG.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón Guardar en contenedor transparente */}
                    <div className="flex justify-end mt-4 pt-4 border-t border-border-warm">
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-8 py-3.5 rounded-sm text-[9.5px] font-black uppercase tracking-widest cursor-pointer transition-all duration-300 active:scale-95 ${saveSuccess
                                    ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500'
                                    : 'bg-purple-accent hover:bg-purple-accent/90 text-white shadow-[0_0_15px_rgba(144,85,255,0.25)] border border-purple-accent'
                                }`}
                        >
                            {saving ? 'Guardando...' : (saveSuccess ? '✓ Ajustes Guardados' : 'Guardar Ajustes')}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
