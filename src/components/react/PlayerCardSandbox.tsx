// src/components/react/PlayerCardSandbox.tsx
import React, { useState } from 'react';
import { PlayerCard, type PlayerData } from './PlayerCard.js';

const CHAMPIONS_LIST = [
  { id: 517, name: 'Sylas', skins: [0, 1, 6, 8, 13] },
  { id: 92, name: 'Riven', skins: [0, 1, 2, 3, 4, 5, 6, 16] },
  { id: 157, name: 'Yasuo', skins: [0, 1, 2, 3, 9, 10, 17] },
  { id: 122, name: 'Darius', skins: [0, 1, 2, 3, 4, 8, 14] },
  { id: 238, name: 'Zed', skins: [0, 1, 2, 3, 10, 11, 13] },
  { id: 222, name: 'Jinx', skins: [0, 1, 2, 3, 4, 12, 20] },
  { id: 103, name: 'Ahri', skins: [0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 17, 27] },
  { id: 64, name: 'LeeSin', skins: [0, 1, 2, 3, 4, 5, 10, 11, 27] },
  { id: 412, name: 'Thresh', skins: [0, 1, 2, 3, 4, 5, 6, 13] },
  { id: 89, name: 'Leona', skins: [0, 1, 2, 3, 4, 8, 9, 10] },
  { id: 81, name: 'Ezreal', skins: [0, 1, 2, 3, 5, 7, 8, 9, 19, 20] },
  { id: 234, name: 'Viego', skins: [0, 1, 10, 19] },
  { id: 268, name: 'Azir', skins: [0, 1, 2, 3, 4, 5] }
];

const TIERS = ['DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'MASTER', 'CHALLENGER', 'UNRANKED'];
const DIVISIONS = ['I', 'II', 'III', 'IV'];

const PRESET_TAGS = [
  'DESPERTANDO',
  'RACHA HOY 3W',
  'TILTEADO (3L)',
  'OTP SYLAS',
  'EXPERTO SYLAS',
  'BUEN CS (8.4/m)',
  'BAJO CS (4.2/m)',
  'GRAN KDA (4.5)',
  'DÚO CON FAKER',
  'VULNERABLE A GANKS',
  'DESTRUCTOR TORRES',
  'FUERA DE ROL (MID)'
];

export const PlayerCardSandbox: React.FC = () => {
  // Estado para Ocultar/Mostrar Sidebar
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Modo de Vista (Single Card vs 5v5 Full Layout)
  const [viewMode, setViewMode] = useState<'single' | '5v5'>('5v5');

  // Estado del Invocador Principal (Ally 3 / MID)
  const [summonerName, setSummonerName] = useState<string>('Frikz#xoro');
  const [profileIconId, setProfileIconId] = useState<number>(3182);
  const [championId, setChampionId] = useState<number>(517);
  const [skinNum, setSkinNum] = useState<number>(1); // Skin de prueba
  const [role, setRole] = useState<string>('MID');

  // Estado SoloQ
  const [soloTier, setSoloTier] = useState<string>('DIAMOND');
  const [soloDivision, setSoloDivision] = useState<string>('II');
  const [soloLp, setSoloLp] = useState<number>(24);
  const [soloWins, setSoloWins] = useState<number>(91);
  const [soloLosses, setSoloLosses] = useState<number>(83);

  // Estado Flex
  const [flexTier, setFlexTier] = useState<string>('EMERALD');
  const [flexDivision, setFlexDivision] = useState<string>('I');
  const [flexLp, setFlexLp] = useState<number>(45);

  // Estado Hoy / Racha
  const [todayWins, setTodayWins] = useState<number>(3);
  const [todayLosses, setTodayLosses] = useState<number>(1);
  const [hasPlayedToday, setHasPlayedToday] = useState<boolean>(true);
  const [streakType, setStreakType] = useState<'win' | 'loss' | null>('win');
  const [streakCount, setStreakCount] = useState<number>(3);
  const [isMain, setIsMain] = useState<boolean>(true);

  // Tags Personalizados
  const [useCustomTags, setUseCustomTags] = useState<boolean>(false);
  const [customTagsList, setCustomTagsList] = useState<string[]>(['OTP SYLAS', 'RACHA HOY 3W', 'BUEN CS (8.4/m)']);
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Hechizos de invocador
  const [spell1Id, setSpell1Id] = useState<number>(4);
  const [spell2Id, setSpell2Id] = useState<number>(14);

  // Entorno visual de prueba
  const [bgMode, setBgMode] = useState<'blank' | 'dark' | 'grid'>('grid');
  const [cardWidth, setCardWidth] = useState<'sm' | 'md' | 'lg' | 'full'>('full');

  // Campeón activo
  const activeChamp = CHAMPIONS_LIST.find(c => c.id === championId) || CHAMPIONS_LIST[0];

  // Construir objeto de datos del jugador activo
  const todayGames = hasPlayedToday ? (todayWins + todayLosses) : 0;
  const todayWr = todayGames > 0 ? Math.round((todayWins / todayGames) * 100) : null;
  const soloWr = (soloWins + soloLosses) > 0 ? Math.round((soloWins / (soloWins + soloLosses)) * 100) : 0;

  const mainPlayerObj: PlayerData = {
    puuid: 'sandbox_test_puuid',
    summonerName,
    riotId: summonerName,
    teamId: 100,
    championId: activeChamp.id,
    championName: activeChamp.name,
    skinId: activeChamp.id * 1000 + skinNum,
    selectedSkinId: activeChamp.id * 1000 + skinNum,
    profileIconId,
    role,
    isMain,
    spell1Id,
    spell2Id,
    ranked: {
      tier: soloTier,
      division: soloDivision,
      rank: soloDivision,
      lp: soloLp,
      leaguePoints: soloLp,
      wins: soloWins,
      losses: soloLosses,
      winrate: soloWr
    },
    rankedFlex: {
      tier: flexTier,
      division: flexDivision,
      rank: flexDivision,
      lp: flexLp,
      leaguePoints: flexLp,
      wins: 40,
      losses: 30,
      winrate: 57
    },
    todayRecord: {
      wins: hasPlayedToday ? todayWins : 0,
      losses: hasPlayedToday ? todayLosses : 0,
      totalGames: todayGames,
      winrate: todayWr,
      streak: {
        type: hasPlayedToday ? streakType : null,
        count: hasPlayedToday ? streakCount : 0
      }
    }
  };

  // Mock 5v5 Teams para vista completa
  const mockAllyTeam: PlayerData[] = [
    {
      puuid: 'ally_top',
      summonerName: 'Exilious#LAS',
      riotId: 'Exilious#LAS',
      teamId: 100,
      championId: 92,
      championName: 'Riven',
      skinId: 92004,
      profileIconId: 4890,
      role: 'TOP',
      isMain: true,
      spell1Id: 12,
      spell2Id: 4,
      ranked: { tier: 'GOLD', rank: 'I', wins: 45, losses: 35, winrate: 56, lp: 75 },
      rankedFlex: { tier: 'SILVER', rank: 'II', wins: 12, losses: 10, winrate: 55, lp: 20 },
      todayRecord: { wins: 3, losses: 0, totalGames: 3, winrate: 100, streak: { type: 'win', count: 3 } }
    },
    {
      puuid: 'ally_jng',
      summonerName: 'NightHunter#LAN',
      riotId: 'NightHunter#LAN',
      teamId: 100,
      championId: 64,
      championName: 'LeeSin',
      skinId: 64011,
      profileIconId: 1420,
      role: 'JNG',
      isMain: false,
      spell1Id: 11,
      spell2Id: 4,
      ranked: { tier: 'DIAMOND', rank: 'IV', wins: 120, losses: 110, winrate: 52, lp: 12 },
      rankedFlex: { tier: 'PLATINUM', rank: 'I', wins: 30, losses: 25, winrate: 54, lp: 88 },
      todayRecord: { wins: 1, losses: 1, totalGames: 2, winrate: 50, streak: { type: null, count: 0 } }
    },
    mainPlayerObj,
    {
      puuid: 'ally_adc',
      summonerName: 'HyperCarry#BR',
      riotId: 'HyperCarry#BR',
      teamId: 100,
      championId: 222,
      championName: 'Jinx',
      skinId: 222012,
      profileIconId: 5390,
      role: 'ADC',
      isMain: true,
      spell1Id: 7,
      spell2Id: 4,
      ranked: { tier: 'EMERALD', rank: 'II', wins: 85, losses: 60, winrate: 58, lp: 50 },
      rankedFlex: { tier: 'GOLD', rank: 'III', wins: 15, losses: 12, winrate: 55, lp: 40 },
      todayRecord: { wins: 5, losses: 0, totalGames: 5, winrate: 100, streak: { type: 'win', count: 5 } }
    },
    {
      puuid: 'ally_supp',
      summonerName: 'HookGod#EUW',
      riotId: 'HookGod#EUW',
      teamId: 100,
      championId: 412,
      championName: 'Thresh',
      skinId: 412005,
      profileIconId: 29,
      role: 'SUPP',
      isMain: false,
      spell1Id: 14,
      spell2Id: 4,
      ranked: { tier: 'PLATINUM', rank: 'III', wins: 40, losses: 38, winrate: 51, lp: 80 },
      rankedFlex: { tier: 'UNRANKED', rank: '', wins: 0, losses: 0, winrate: 0, lp: 0 },
      todayRecord: { wins: 0, losses: 0, totalGames: 0, winrate: null, streak: { type: null, count: 0 } }
    }
  ];

  const mockEnemyTeam: PlayerData[] = [
    {
      puuid: 'enemy_top',
      summonerName: 'NoxusKing#KR',
      riotId: 'NoxusKing#KR',
      teamId: 200,
      championId: 122,
      championName: 'Darius',
      skinId: 122004,
      profileIconId: 3500,
      role: 'TOP',
      isMain: false,
      spell1Id: 12,
      spell2Id: 4,
      ranked: { tier: 'EMERALD', rank: 'I', wins: 95, losses: 90, winrate: 51, lp: 45 },
      rankedFlex: { tier: 'GOLD', rank: 'I', wins: 20, losses: 18, winrate: 52, lp: 10 },
      todayRecord: { wins: 0, losses: 4, totalGames: 4, winrate: 0, streak: { type: 'loss', count: 4 } }
    },
    {
      puuid: 'enemy_jng',
      summonerName: 'ShadowReaper#NA',
      riotId: 'ShadowReaper#NA',
      teamId: 200,
      championId: 234,
      championName: 'Viego',
      skinId: 234001,
      profileIconId: 4210,
      role: 'JNG',
      isMain: true,
      spell1Id: 11,
      spell2Id: 4,
      ranked: { tier: 'DIAMOND', rank: 'III', wins: 110, losses: 95, winrate: 53, lp: 90 },
      rankedFlex: { tier: 'EMERALD', rank: 'IV', wins: 40, losses: 35, winrate: 53, lp: 15 },
      todayRecord: { wins: 2, losses: 1, totalGames: 3, winrate: 66, streak: { type: 'win', count: 2 } }
    },
    {
      puuid: 'enemy_mid',
      summonerName: 'FakerFan#KR1',
      riotId: 'FakerFan#KR1',
      teamId: 200,
      championId: 238,
      championName: 'Zed',
      skinId: 238011,
      profileIconId: 5880,
      role: 'MID',
      isMain: true,
      spell1Id: 14,
      spell2Id: 4,
      ranked: { tier: 'CHALLENGER', rank: 'I', wins: 340, losses: 210, winrate: 61, lp: 1200 },
      rankedFlex: { tier: 'MASTER', rank: 'I', wins: 90, losses: 40, winrate: 69, lp: 450 },
      todayRecord: { wins: 8, losses: 0, totalGames: 8, winrate: 100, streak: { type: 'win', count: 8 } }
    },
    {
      puuid: 'enemy_adc',
      summonerName: 'ArcaneShot#LAS',
      riotId: 'ArcaneShot#LAS',
      teamId: 200,
      championId: 81,
      championName: 'Ezreal',
      skinId: 81019,
      profileIconId: 2080,
      role: 'ADC',
      isMain: false,
      spell1Id: 7,
      spell2Id: 4,
      ranked: { tier: 'GOLD', rank: 'II', wins: 50, losses: 55, winrate: 47, lp: 20 },
      rankedFlex: { tier: 'SILVER', rank: 'I', wins: 15, losses: 20, winrate: 42, lp: 5 },
      todayRecord: { wins: 0, losses: 3, totalGames: 3, winrate: 0, streak: { type: 'loss', count: 3 } }
    },
    {
      puuid: 'enemy_supp',
      summonerName: 'SunLight#EUW',
      riotId: 'SunLight#EUW',
      teamId: 200,
      championId: 89,
      championName: 'Leona',
      skinId: 89008,
      profileIconId: 1200,
      role: 'SUPP',
      isMain: false,
      spell1Id: 14,
      spell2Id: 4,
      ranked: { tier: 'EMERALD', rank: 'IV', wins: 60, losses: 58, winrate: 50, lp: 10 },
      rankedFlex: { tier: 'GOLD', rank: 'IV', wins: 10, losses: 10, winrate: 50, lp: 50 },
      todayRecord: { wins: 1, losses: 1, totalGames: 2, winrate: 50, streak: { type: null, count: 0 } }
    }
  ];

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().toUpperCase();
    if (trimmed && !customTagsList.includes(trimmed)) {
      setCustomTagsList([...customTagsList, trimmed]);
      setNewTagInput('');
      setUseCustomTags(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCustomTagsList(customTagsList.filter(t => t !== tagToRemove));
  };

  const handleTogglePresetTag = (preset: string) => {
    if (customTagsList.includes(preset)) {
      setCustomTagsList(customTagsList.filter(t => t !== preset));
    } else {
      setCustomTagsList([...customTagsList, preset]);
      setUseCustomTags(true);
    }
  };

  const getBgClass = () => {
    switch (bgMode) {
      case 'blank': return 'bg-white text-slate-900';
      case 'dark': return 'bg-[#08080a] text-slate-100';
      case 'grid': return 'premium-bg text-slate-100';
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen font-sans select-none overflow-hidden relative">
      {/* PANEL LATERAL DE CONTROLES E INTERACTIVIDAD */}
      <div className={`transition-all duration-300 z-30 shrink-0 ${
        sidebarOpen 
          ? 'w-full md:w-80 lg:w-96 bg-[#0f0e17] border-r border-purple-950/80 p-4 overflow-y-auto h-full flex flex-col gap-4 text-xs scrollbar-thin' 
          : 'w-0 p-0 overflow-hidden border-0 pointer-events-none'
      }`}>
        <div className="pb-2 border-b border-purple-900/40 flex justify-between items-center">
          <h2 className="font-black text-sm text-white uppercase tracking-wider text-purple-400 font-mono">
            [LABORATORIO DE CARDS]
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-mono text-[10px] rounded border border-purple-800/40 cursor-pointer"
          >
            Ocultar
          </button>
        </div>

        {/* MODO DE VISTA */}
        <div className="flex flex-col gap-2 bg-[#141221] p-2.5 rounded border border-purple-900/40">
          <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono">Modo de Vista</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setViewMode('single')}
              className={`py-1.5 px-2 rounded font-mono font-bold text-xs uppercase cursor-pointer border ${viewMode === 'single' ? 'bg-black/90 text-purple-300 border-purple-500' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-purple-800'}`}
            >
              1 Tarjeta
            </button>
            <button
              onClick={() => setViewMode('5v5')}
              className={`py-1.5 px-2 rounded font-mono font-bold text-xs uppercase cursor-pointer border ${viewMode === '5v5' ? 'bg-black/90 text-purple-300 border-purple-500' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-purple-800'}`}
            >
              5 vs 5 Completo
            </button>
          </div>
        </div>

        {/* ENTORNO Y TAMAÑO */}
        <div className="flex flex-col gap-2 bg-[#141221] p-2.5 rounded border border-purple-900/40">
          <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono">Fondo del Entorno</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['blank', 'dark', 'grid'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBgMode(b)}
                className={`py-1 px-1.5 rounded font-mono text-[10px] uppercase cursor-pointer border ${bgMode === b ? 'bg-black/90 text-purple-300 border-purple-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
              >
                {b}
              </button>
            ))}
          </div>

          {viewMode === 'single' && (
            <>
              <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono mt-1">Ancho de Tarjeta</label>
              <div className="grid grid-cols-4 gap-1">
                {(['sm', 'md', 'lg', 'full'] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => setCardWidth(w)}
                    className={`py-1 rounded font-mono text-[10px] uppercase cursor-pointer border ${cardWidth === w ? 'bg-black/90 text-purple-300 border-purple-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ADMINISTRADOR DE TAGS PERSONALIZADOS */}
        <div className="flex flex-col gap-2 bg-[#141221] p-2.5 rounded border border-purple-900/40">
          <div className="flex justify-between items-center">
            <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono">Tags y Prioridades</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 font-mono">{useCustomTags ? 'Manuales' : 'Calculados'}</span>
              <input
                type="checkbox"
                checked={useCustomTags}
                onChange={(e) => setUseCustomTags(e.target.checked)}
                className="accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          {/* INPUT PARA AGREGAR CUALQUIER TAG */}
          <div className="flex gap-1">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Escribe un tag..."
              className="flex-1 bg-black/60 border border-purple-900/50 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleAddTag}
              className="px-2.5 py-1 bg-black/80 hover:bg-[#151224] text-purple-300 font-mono font-bold text-xs rounded border border-purple-600/50 cursor-pointer"
            >
              +
            </button>
          </div>

          {/* LISTA DE TAGS ACTIVOS */}
          {customTagsList.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1 p-1.5 bg-black/40 rounded border border-purple-950/60">
              {customTagsList.map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-black/80 border border-purple-600/50 text-purple-200 text-[9px] font-mono font-bold flex items-center gap-1 shadow-sm"
                >
                  {t}
                  <button
                    onClick={() => handleRemoveTag(t)}
                    className="text-purple-400 hover:text-white font-black ml-0.5 cursor-pointer"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* TAGS PREDEFINIDOS DE RÁPIDA SELECCIÓN */}
          <div className="mt-1">
            <span className="text-[9px] text-slate-400 font-mono">Presets del nuevo motor:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_TAGS.map(preset => {
                const isSelected = customTagsList.includes(preset);
                return (
                  <button
                    key={preset}
                    onClick={() => handleTogglePresetTag(preset)}
                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold border cursor-pointer transition-colors ${isSelected ? 'bg-black/90 text-purple-300 border-purple-500/70' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-purple-800'}`}
                  >
                    {isSelected ? `- ${preset}` : `+ ${preset}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* INVOCADOR, CAMPEÓN Y SKIN */}
        <div className="flex flex-col gap-2 bg-[#141221] p-2.5 rounded border border-purple-900/30">
          <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono">Invocador, Campeón y Skin ({viewMode === '5v5' ? 'Ally MID' : 'Modo 1'})</label>
          
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Nombre / Riot ID</span>
            <input
              type="text"
              value={summonerName}
              onChange={(e) => setSummonerName(e.target.value)}
              className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">Profile Icon ID</span>
              <input
                type="number"
                value={profileIconId}
                onChange={(e) => setProfileIconId(Number(e.target.value))}
                className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">Rol</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              >
                {['TOP', 'JNG', 'MID', 'ADC', 'SUPP'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">Campeón</span>
              <select
                value={championId}
                onChange={(e) => {
                  setChampionId(Number(e.target.value));
                  setSkinNum(0);
                }}
                className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              >
                {CHAMPIONS_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">Skin Index (Splash)</span>
              <input
                type="number"
                min="0"
                max="50"
                value={skinNum}
                onChange={(e) => setSkinNum(Math.max(0, Number(e.target.value)))}
                className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* SESIÓN DEL DÍA / RACHAS */}
        <div className="flex flex-col gap-2 bg-[#141221] p-2.5 rounded border border-purple-900/30">
          <label className="font-bold text-purple-400 uppercase tracking-wider text-[10px] font-mono">Sesión Hoy & Racha</label>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-300">¿Ha jugado hoy?</span>
            <input
              type="checkbox"
              checked={hasPlayedToday}
              onChange={(e) => setHasPlayedToday(e.target.checked)}
              className="accent-purple-600 cursor-pointer"
            />
          </div>

          {hasPlayedToday ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-400">Wins Hoy</span>
                <input
                  type="number"
                  value={todayWins}
                  onChange={(e) => setTodayWins(Number(e.target.value))}
                  className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-400">Losses Hoy</span>
                <input
                  type="number"
                  value={todayLosses}
                  onChange={(e) => setTodayLosses(Number(e.target.value))}
                  className="bg-black/60 border border-purple-900/50 rounded p-1 text-white font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-amber-300/80 font-mono bg-amber-950/30 p-1.5 rounded border border-amber-800/40">
              Estado: 0W - 0L (Despertando / Frío)
            </div>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className={`flex-1 flex flex-col items-center justify-center p-4 min-h-0 overflow-y-auto ${getBgClass()}`}>
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-40 px-3 py-1.5 bg-[#0f0e17] hover:bg-[#191629] text-purple-300 font-mono text-xs rounded border border-purple-800/50 shadow-lg cursor-pointer flex items-center gap-1.5"
          >
            <span>[Panel de Ajustes]</span>
          </button>
        )}

        {viewMode === 'single' ? (
          <div className="w-full flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <h1 className="text-base font-black text-purple-400 uppercase font-mono tracking-wider">
                Preview Individual
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Skin: {activeChamp.name} #{skinNum} | Tags: {useCustomTags ? 'Manuales' : 'Dinámicos'}
              </p>
            </div>

            <div className={`
              flex justify-center items-center transition-all duration-300
              ${cardWidth === 'sm' ? 'w-[200px]' : cardWidth === 'md' ? 'w-[240px]' : cardWidth === 'lg' ? 'w-[270px]' : 'w-full max-w-[288px]'}
            `}>
              <PlayerCard
                player={mainPlayerObj}
                customTags={useCustomTags ? customTagsList : undefined}
                mode={cardWidth === 'sm' ? 'compact' : 'normal'}
              />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1400px] flex flex-col justify-between h-full min-h-[580px] p-2 xl:p-4 text-slate-200">
            {/* EQUIPO AZUL */}
            <div className="flex-1 min-h-0 py-1">
              <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase mb-1">Equipo Aliado (Ordenado por Rol)</div>
              <div className="grid grid-cols-5 gap-2 xl:gap-3 flex-1 min-h-0 w-full items-stretch h-full">
                {mockAllyTeam.map((p, idx) => (
                  <PlayerCard
                    key={p.puuid || `ally_${idx}`}
                    player={idx === 2 ? mainPlayerObj : p}
                    index={idx}
                    isAlly={true}
                    customTags={idx === 2 && useCustomTags ? customTagsList : undefined}
                  />
                ))}
              </div>
            </div>

            {/* SEPARADOR VS */}
            <div className="relative my-2 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-purple-900/60" />
              </div>
              <div className="relative px-4 py-0.5 bg-[#0e0a1a] border border-purple-600/50 rounded-sm text-purple-400 font-black text-xs xl:text-base italic tracking-widest shadow-lg select-none">
                VS
              </div>
            </div>

            {/* EQUIPO ROJO */}
            <div className="flex-1 min-h-0 py-1">
              <div className="text-[10px] font-mono text-rose-400 font-bold uppercase mb-1">Equipo Enemigo</div>
              <div className="grid grid-cols-5 gap-2 xl:gap-3 flex-1 min-h-0 w-full items-stretch h-full">
                {mockEnemyTeam.map((p, idx) => (
                  <PlayerCard
                    key={p.puuid || `enemy_${idx}`}
                    player={p}
                    index={idx}
                    isAlly={false}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
