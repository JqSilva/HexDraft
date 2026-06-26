import React, { useState, useEffect, useMemo, useRef } from 'react';
import { hydrateAsset } from '../../lib/engine/hydrator';
import { getPathsForBuild } from '../../lib/engine/itemEngine';
import { CHAMPIONS_DB } from '../../lib/data/championdb.js';
import META_CACHE from '../../lib/data/meta-cache.json';
import { getChampionCdnName } from '../../lib/championMapper';

// Mapeos de imágenes de posición de League of Legends
const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";
const posMapping: Record<string, string> = {
  "TOP": "icon-position-top.png",
  "JUNGLE": "icon-position-jungle.png",
  "JNG": "icon-position-jungle.png",
  "MIDDLE": "icon-position-middle.png",
  "MID": "icon-position-middle.png",
  "BOTTOM": "icon-position-bottom.png",
  "BOT": "icon-position-bottom.png",
  "ADC": "icon-position-bottom.png",
  "UTILITY": "icon-position-utility.png",
  "SUP": "icon-position-utility.png",
  "SUPPORT": "icon-position-utility.png"
};

// Traducciones legibles de posiciones
const posLabels: Record<string, string> = {
  "TOP": "Top",
  "JUNGLE": "Jungla",
  "JNG": "Jungla",
  "MIDDLE": "Mid",
  "MID": "Mid",
  "BOTTOM": "ADC",
  "BOT": "ADC",
  "ADC": "ADC",
  "UTILITY": "Soporte",
  "SUP": "Soporte",
  "SUPPORT": "Soporte"
};


// Mapear rank a Tier
const getTierInfo = (tierNum: number) => {
  if (tierNum <= 5) return { label: 'S+', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
  if (tierNum <= 12) return { label: 'S', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
  if (tierNum <= 22) return { label: 'A', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
  if (tierNum <= 35) return { label: 'B', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
  if (tierNum <= 48) return { label: 'C', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };
  return { label: 'D', color: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
};

// Mapear rol a clave interna
const getRoleKey = (lane: string) => {
  const upper = (lane || "").toUpperCase();
  if (upper === "JNG" || upper === "JUNGLE") return "JUNGLE";
  if (upper === "MID" || upper === "MIDDLE") return "MIDDLE";
  if (upper === "BOT" || upper === "ADC" || upper === "BOTTOM") return "BOTTOM";
  if (upper === "SUP" || upper === "SUPPORT" || upper === "UTILITY") return "UTILITY";
  return upper;
};

// Mapear rol a clave del cache
const laneToMetaKey = (lane: string): string => {
  const mapping: Record<string, string> = {
    "TOP": "top",
    "JNG": "jungle",
    "JUNGLE": "jungle",
    "MID": "mid",
    "MIDDLE": "mid",
    "BOT": "adc",
    "ADC": "adc",
    "BOTTOM": "adc",
    "SUP": "support",
    "SUPPORT": "support",
    "UTILITY": "support"
  };
  return mapping[(lane || "").toUpperCase()] || "";
};

const RUNE_TREES: Record<number, {
  name: string;
  icon: string;
  rows: number[][];
}> = {
  8000: {
    name: "Precision",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7201_precision.png",
    rows: [
      [8005, 8008, 8021, 8010],
      [9101, 9111, 8009],
      [9104, 9103, 9105],
      [8014, 8017, 8299]
    ]
  },
  8100: {
    name: "Domination",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png",
    rows: [
      [8112, 8124, 8128, 9923],
      [8126, 8139, 8143],
      [8136, 8120, 8138],
      [8135, 8105, 8106]
    ]
  },
  8200: {
    name: "Sorcery",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png",
    rows: [
      [8214, 8229, 8230],
      [8224, 8226, 8275],
      [8210, 8234, 8233],
      [8237, 8232, 8236]
    ]
  },
  8400: {
    name: "Resolve",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7204_resolve.png",
    rows: [
      [8437, 8439, 8465],
      [8446, 8463, 8401],
      [8429, 8444, 8473],
      [8451, 8453, 8242]
    ]
  },
  8300: {
    name: "Inspiration",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7203_whimsy.png",
    rows: [
      [8351, 8360, 8369],
      [8306, 8304, 8321],
      [8313, 8345, 8352],
      [8347, 8410, 8316]
    ]
  }
};

const getTreeColors = (styleId: number) => {
  const mapping: Record<number, { border: string; bg: string; shadow: string }> = {
    8000: { border: 'border-yellow-500/80', bg: 'bg-yellow-500/20', shadow: 'shadow-[0_0_12px_rgba(234,179,8,0.4)]' },
    8100: { border: 'border-red-500/80', bg: 'bg-red-500/20', shadow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]' },
    8200: { border: 'border-blue-500/80', bg: 'bg-blue-500/20', shadow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]' },
    8400: { border: 'border-emerald-500/80', bg: 'bg-emerald-500/20', shadow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]' },
    8300: { border: 'border-cyan-400/80', bg: 'bg-cyan-400/20', shadow: 'shadow-[0_0_12px_rgba(34,211,238,0.4)]' }
  };
  return mapping[styleId] || { border: 'border-purple-accent', bg: 'bg-purple-accent/20', shadow: 'shadow-[0_0_10px_rgba(144,85,255,0.3)]' };
};

const SHARDS_ROWS = [
  [5005, 5008, 5007],
  [5008, 5010, 5011],
  [5013, 5012, 5011]
];

const normalizeShardIdForHighlight = (selectedId: number, rowIdx: number): number => {
  if (rowIdx === 2) {
    if (selectedId === 5001 || selectedId === 5003) return 5013; // Armor/MR -> Flat Health
  }
  if (rowIdx === 1) {
    if (selectedId === 5001 || selectedId === 5003) return 5011; // Armor/MR -> Scaling Health
  }
  return selectedId;
};

const getRuneAlias = (id: number): number[] => {
  const aliases: Record<number, number[]> = {
    8136: [8136, 8141], // Zombie Ward / Deep Ward
    8141: [8136, 8141],
    8138: [8138, 8140], // Eyeball Collection / Grisly Mementos
    8140: [8138, 8140]
  };
  return aliases[id] || [id];
};

const RuneTree = ({ styleId, selections, isPrimary }: { styleId: number; selections: number[]; isPrimary: boolean }) => {
  const tree = RUNE_TREES[styleId];
  const colors = getTreeColors(styleId);

  if (!tree) {
    return (
      <div className="flex flex-col gap-2">
        {selections.map(id => {
          const r = hydrateAsset('runes', id);
          return (
            <div key={id} className="flex items-center gap-2">
              {r?.icon && <img src={r.icon} className="w-6 h-6 object-contain" alt={r.name} />}
              <span className="text-xs text-slate-300">{r?.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const rowsToShow = isPrimary ? tree.rows : tree.rows.slice(1);

  return (
    <div className="flex flex-col gap-2 items-center">
      {rowsToShow.map((row, rowIdx) => {
        const isKeystoneRow = isPrimary && rowIdx === 0;
        return (
          <div key={rowIdx} className="flex gap-2.5 justify-center items-center">
            {row.map(runeId => {
              const r = hydrateAsset('runes', runeId);
              const isActive = selections.some(selId => getRuneAlias(selId).includes(runeId));
              return (
                <div
                  key={runeId}
                  className={`relative flex items-center justify-center rounded-full transition-all duration-200 cursor-default
                    ${isKeystoneRow 
                      ? 'w-10 h-10 border-2' 
                      : 'w-8 h-8 border'}
                    ${isActive 
                      ? `${colors.border} ${colors.bg} ${colors.shadow} scale-110 ring-2 ring-purple-500/10`
                      : isKeystoneRow
                        ? 'border-slate-800 bg-black/40 opacity-30 grayscale hover:opacity-60 hover:border-slate-700'
                        : 'border-slate-800/60 bg-black/30 opacity-30 grayscale hover:opacity-60 hover:border-slate-700/60'}`}
                  title={r?.name}
                >
                  {r?.icon && (
                    <img 
                      src={r.icon} 
                      className={`${isKeystoneRow ? 'w-4/5 h-4/5' : 'w-3/4 h-3/4'} object-contain`} 
                      alt={r.name} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const ShardsTree = ({ selections }: { selections: number[] }) => {
  return (
    <div className="flex flex-col gap-2 items-center">
      {SHARDS_ROWS.map((row, rowIdx) => {
        const selectedId = selections[rowIdx];
        const normalizedSelectedId = normalizeShardIdForHighlight(selectedId, rowIdx);
        return (
          <div key={rowIdx} className="flex gap-2 justify-center items-center">
            {row.map(shardId => {
              const s = hydrateAsset('shards', shardId);
              const isActive = shardId === normalizedSelectedId;
              return (
                <div
                  key={shardId}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200 cursor-default
                    ${isActive 
                      ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_6px_rgba(234,179,8,0.25)] scale-110' 
                      : 'border-slate-800/40 bg-black/20 opacity-30 grayscale hover:opacity-60 hover:border-slate-700/40'}`}
                  title={s?.name}
                >
                  {s?.icon && (
                    <img src={s.icon} className="w-3.5 h-3.5 object-contain" alt={s.name} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const formatTimeAgo = (dateStr: string): string => {
  if (!dateStr || dateStr === '-') return 'Nunca';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Nunca';
  
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return 'Hace unos segundos';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
};

const normalizeKey = (name: string) => {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/\s+&\s+/g, ' y ')
    .replace(/\s+and\s+/g, ' y ')
    .replace(/[^a-z0-9]/g, "");
};

const getEnrichedChampionsFromMeta = (metaData: any) => {
  const tempStats: Record<string, {
    name: string;
    laneStats: Array<{
      lane: string;
      winRate: number;
      pickRate: number;
      rank: number;
      counters: string[];
    }>;
  }> = {};

  const roleToLaneMap: Record<string, string> = {
    'top': 'TOP',
    'jungle': 'JUNGLE',
    'mid': 'MIDDLE',
    'adc': 'BOTTOM',
    'support': 'UTILITY'
  };

  const lanes = ['top', 'jungle', 'mid', 'adc', 'support'];
  if (metaData) {
    lanes.forEach(laneKey => {
      const list = metaData[laneKey] || [];
      list.forEach((entry: any) => {
        const normName = normalizeKey(entry.name);
        if (!tempStats[normName]) {
          tempStats[normName] = { name: entry.name, laneStats: [] };
        }
        const wr = parseFloat(entry.winRate) || 50.0;
        const pr = parseFloat(entry.pickRate) || 0.0;
        const rank = parseInt(entry.rank) || 99;
        const dbLane = roleToLaneMap[laneKey];
        tempStats[normName].laneStats.push({
          lane: dbLane,
          winRate: wr,
          pickRate: pr,
          rank: rank,
          counters: entry.counters || []
        });
      });
    });
  }

  const getRoleKey = (lane: string) => {
    const upper = (lane || "").toUpperCase();
    if (upper === "JNG" || upper === "JUNGLE") return "JUNGLE";
    if (upper === "MID" || upper === "MIDDLE") return "MIDDLE";
    if (upper === "BOT" || upper === "ADC" || upper === "BOTTOM") return "BOTTOM";
    if (upper === "SUP" || upper === "SUPPORT" || upper === "UTILITY") return "UTILITY";
    return upper;
  };

  return Object.values(CHAMPIONS_DB).map((champ: any) => {
    const normName = normalizeKey(champ.name);
    const statsEntry = tempStats[normName];
    
    let bestLane = champ.lane || "MID";
    let wr = 50.0;
    let tierVal = 99;
    let pickrate = 1.5;
    let matches = 1000;
    let lanesStats: Record<string, any> = {};
    let lanesPickrate: Record<string, number> = {};

    if (statsEntry && statsEntry.laneStats.length > 0) {
      let maxPick = -1;
      let primaryEntry = statsEntry.laneStats[0];
      statsEntry.laneStats.forEach(le => {
        lanesStats[le.lane] = { winRate: le.winRate, tier: le.rank };
        lanesPickrate[le.lane] = le.pickRate;
        if (le.pickRate > maxPick) {
          maxPick = le.pickRate;
          primaryEntry = le;
        }
      });

      bestLane = primaryEntry.lane;
      wr = primaryEntry.winRate;
      tierVal = primaryEntry.rank;
      
      const totalPick = statsEntry.laneStats.reduce((sum, le) => sum + le.pickRate, 0);
      pickrate = parseFloat(totalPick.toFixed(1));
      matches = Math.floor(pickrate * 1420) + 1200 + (champ.id % 7) * 110;
    } else {
      const baseLane = getRoleKey(champ.lane || "MID");
      lanesStats[baseLane] = { winRate: 50.0, tier: 99 };
      lanesPickrate[baseLane] = 1.5;
    }

    return {
      id: champ.id,
      name: champ.name,
      lane: bestLane,
      damageType: champ.damageType || "Adaptive",
      class: champ.class || "Mage",
      isFrontline: champ.isFrontline || false,
      isHypercarry: champ.isHypercarry || false,
      hasHardCC: champ.hasHardCC || false,
      tags: champ.tags || [],
      scalingType: champ.scalingType || "Mid",
      pickrate,
      matches,
      lanesStats,
      lanesPickrate,
      meta: {
        winRate: wr,
        tier: tierVal
      }
    };
  });
};

export const ChampionsStats = ({ initialChampionId, initialLane }: { initialChampionId?: number; initialLane?: string }) => {
  // Convertir CHAMPIONS_DB a array y enriquecerlo de forma básica para carga instantánea
  const initialChamps = useMemo(() => {
    return getEnrichedChampionsFromMeta(META_CACHE);
  }, []);

  // Estados de datos
  const [champions, setChampions] = useState<any[]>(initialChamps);
  const [loading, setLoading] = useState(false); // Carga instantánea desde JSON
  const [error, setError] = useState<string | null>(null);
  const [gameVersion, setGameVersion] = useState("14.9.1");
  const [metaCache, setMetaCache] = useState<any>(META_CACHE);
  const [lastUpdated, setLastUpdated] = useState<string>("-");
  const [timeAgoText, setTimeAgoText] = useState<string>("Nunca");

  // Filtros y ordenación (Predeterminado: Tier ascendente -> mejor rank primero)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLane, setSelectedLane] = useState(() => {
    if (initialLane) {
      const upper = initialLane.toUpperCase();
      if (upper === "ADC" || upper === "BOT" || upper === "BOTTOM") return "ADC";
      if (upper === "JNG" || upper === "JUNGLE") return "JNG";
      if (upper === "MID" || upper === "MIDDLE") return "MID";
      if (upper === "SUP" || upper === "SUPPORT" || upper === "UTILITY") return "SUP";
      return upper;
    }
    return "ALL";
  });
  const [sortBy, setSortBy] = useState<'winrate' | 'pickrate' | 'tier' | 'name'>('tier');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Vista de detalle
  const [selectedChamp, setSelectedChamp] = useState<any | null>(() => {
    if (initialChampionId) {
      return initialChamps.find((c: any) => c.id === initialChampionId) || null;
    }
    return null;
  });
  const [champDetails, setChampDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeBuildIdx, setActiveBuildIdx] = useState(0);
  const [tacticalData, setTacticalData] = useState<any | null>(null);
  const [tacticalLoading, setTacticalLoading] = useState(false);
  const [spellImages, setSpellImages] = useState<Record<string, string>>({});

  // Cargar lista básica de base de datos y metaCache en segundo plano al montar
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Intentar obtener la versión actual del LCU
        try {
          const meRes = await fetch('/api/me');
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.gameVersion) {
              setGameVersion(meData.gameVersion);
            }
          }
        } catch (e) {
          console.warn("No se pudo obtener versión de /api/me, usando default 14.9.1", e);
        }

        // Cargar meta cache (OP.GG stats)
        try {
          const metaRes = await fetch('/api/meta');
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            if (metaData.meta) {
              setMetaCache(metaData.meta);
              const freshChamps = getEnrichedChampionsFromMeta(metaData.meta);
              setChampions(freshChamps);
            }
            if (metaData.lastUpdated) {
              setLastUpdated(metaData.lastUpdated);
            }
          }
        } catch (e) {
          console.warn("No se pudo obtener el meta cache de /api/meta", e);
        }
      } catch (err: any) {
        console.error("Error al cargar lista en background:", err);
      }
    };

    loadInitialData();
  }, []);

  // Cargar detalles específicos (builds, runes, counters, synergies) del campeón seleccionado
  useEffect(() => {
    if (!selectedChamp) {
      setChampDetails(null);
      return;
    }

    const loadChampDetails = async () => {
      setDetailsLoading(true);
      try {
        const res = await fetch(`/api/champions?id=${selectedChamp.id}`);
        if (res.ok) {
          const data = await res.json();
          setChampDetails(data);
        }
      } catch (e) {
        console.error("Fallo al obtener detalles del campeón de la base de datos:", e);
      } finally {
        setDetailsLoading(false);
      }
    };

    loadChampDetails();
  }, [selectedChamp]);

  // Actualizar el texto dinámico "Hace x minutos" cada 30 segundos si la pestaña está abierta
  useEffect(() => {
    if (!lastUpdated || lastUpdated === '-') {
      setTimeAgoText('Nunca');
      return;
    }
    
    const updateText = () => {
      setTimeAgoText(formatTimeAgo(lastUpdated));
    };
    
    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Polling de /api/meta cada 60 segundos para capturar actualizaciones silenciosas en segundo plano
  useEffect(() => {
    const pollMeta = async () => {
      try {
        const metaRes = await fetch('/api/meta');
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.meta) {
            setMetaCache(metaData.meta);
          }
          if (metaData.lastUpdated) {
            setLastUpdated(metaData.lastUpdated);
          }
        }
      } catch (e) {
        console.warn("Error haciendo polling a /api/meta:", e);
      }
    };

    const interval = setInterval(pollMeta, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cargar datos tácticos detallados (habilidades de OP.GG) cuando se selecciona un campeón
  useEffect(() => {
    if (!selectedChamp) {
      setTacticalData(null);
      return;
    }

    setActiveBuildIdx(0); // Reset a la build recomendada por defecto
    const loadTactical = async () => {
      setTacticalLoading(true);
      try {
        const activeDetailLane = selectedLane === "ALL" 
          ? (getRoleKey(selectedChamp.lane) !== "UNKNOWN" ? getRoleKey(selectedChamp.lane) : (getRoleKey(selectedChamp.playLanes?.[0]) || "TOP"))
          : getRoleKey(selectedLane);
        const laneQuery = activeDetailLane.toLowerCase();
        const res = await fetch(`/api/tactical-data?champion=${selectedChamp.name}&role=${laneQuery}`);
        if (res.ok) {
          const tData = await res.json();
          setTacticalData(tData);
        } else {
          setTacticalData(null);
        }
      } catch (e) {
        console.warn("Fallo al cargar datos de habilidades detallados:", e);
        setTacticalData(null);
      } finally {
        setTacticalLoading(false);
      }
    };

    loadTactical();
  }, [selectedChamp, selectedLane]);

  useEffect(() => {
    if (!selectedChamp) {
      setSpellImages({});
      return;
    }
    const fetchChampionSpells = async () => {
      try {
        const splashName = getChampionCdnName(selectedChamp.name);
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/data/es_ES/champion/${splashName}.json`);
        if (res.ok) {
          const json = await res.json();
          const champData = json.data[splashName];
          if (champData && champData.spells) {
            setSpellImages({
              Q: `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/spell/${champData.spells[0].image.full}`,
              W: `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/spell/${champData.spells[1].image.full}`,
              E: `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/spell/${champData.spells[2].image.full}`,
              R: `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/spell/${champData.spells[3].image.full}`
            });
          }
        }
      } catch (err) {
        console.warn("No se pudieron obtener los iconos de habilidades de DDragon", err);
      }
    };
    fetchChampionSpells();
  }, [selectedChamp, gameVersion]);

  // Filtrar y ordenar campeones
  const processedChampions = useMemo(() => {
    const metaKey = laneToMetaKey(selectedLane);
    
    // Si hay un carril específico seleccionado y tenemos los datos de metaCache para ese carril
    if (selectedLane !== "ALL" && metaCache && metaCache[metaKey]) {
      const laneList = metaCache[metaKey] || [];
      const list: any[] = [];
      
      laneList.forEach((metaChamp: any) => {
        // Encontrar el campeón por nombre normalizado
        const normMetaName = normalizeKey(metaChamp.name);
        const dbChamp = champions.find(c => normalizeKey(c.name) === normMetaName);
        if (dbChamp) {
          const winRate = parseFloat(metaChamp.winRate) || 50.0;
          const tier = parseInt(metaChamp.rank) || 99;
          const pickRateNum = parseFloat(metaChamp.pickRate) || 0.0;
          
          list.push({
            ...dbChamp,
            lane: getRoleKey(selectedLane),
            pickrate: pickRateNum,
            meta: {
              winRate,
              tier
            }
          });
        }
      });
      
      let filteredList = list;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        filteredList = list.filter(c => c.name.toLowerCase().includes(q));
      }
      
      // Ordenar
      filteredList.sort((a, b) => {
        if (sortBy === 'name') {
          return sortOrder === 'asc' 
            ? a.name.localeCompare(b.name) 
            : b.name.localeCompare(a.name);
        }

        if (sortBy === 'winrate') {
          const wrA = a.meta?.winRate || 50.0;
          const wrB = b.meta?.winRate || 50.0;
          return sortOrder === 'asc' ? wrA - wrB : wrB - wrA;
        }

        if (sortBy === 'pickrate') {
          return sortOrder === 'asc' ? a.pickrate - b.pickrate : b.pickrate - a.pickrate;
        }

        if (sortBy === 'tier') {
          const tA = a.meta?.tier ?? 999;
          const tB = b.meta?.tier ?? 999;
          return sortOrder === 'asc' ? tA - tB : tB - tA;
        }

        return 0;
      });
      
      return filteredList;
    }

    // Fallback si no hay carril específico o no hay metaCache
    let list = [...champions];

    // Filtro por carril (sólo si no usamos metaCache)
    if (selectedLane !== "ALL") {
      list = list.filter(c => {
        const dbLane = c.lane?.toUpperCase() || "";
        const target = getRoleKey(selectedLane);
        return dbLane === target;
      });
    }

    // Filtro por buscador
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    // Ordenar
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }

      if (sortBy === 'winrate') {
        const wrA = a.meta?.winRate || 50.0;
        const wrB = b.meta?.winRate || 50.0;
        return sortOrder === 'asc' ? wrA - wrB : wrB - wrA;
      }

      if (sortBy === 'pickrate') {
        return sortOrder === 'asc' ? a.pickrate - b.pickrate : b.pickrate - a.pickrate;
      }

      if (sortBy === 'tier') {
        const tA = a.meta?.tier || 99;
        const tB = b.meta?.tier || 99;
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      }

      return 0;
    });

    return list;
  }, [champions, searchQuery, selectedLane, sortBy, sortOrder, metaCache]);

  const toggleSort = (field: 'winrate' | 'pickrate' | 'tier' | 'name') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' || field === 'tier' ? 'asc' : 'desc');
    }
  };

  // Icono para la ordenación activa
  const renderSortIndicator = (field: 'winrate' | 'pickrate' | 'tier' | 'name') => {
    if (sortBy !== field) return null;
    return (
      <span className="ml-1 text-purple-accent select-none inline-block align-middle text-[10px]">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  // Obtener builds para el campeón seleccionado
  const buildsList = useMemo(() => {
    const champ = champDetails || selectedChamp;
    if (!champ) return [];
    
    const activeDetailLane = selectedLane === "ALL" 
      ? (getRoleKey(champ.lane) !== "UNKNOWN" ? getRoleKey(champ.lane) : (getRoleKey(champ.playLanes?.[0]) || "TOP"))
      : getRoleKey(selectedLane);

    let list = [...(champ.builds || [])].filter(b => getRoleKey(b.lane) === activeDetailLane);
    if (list.length === 0) {
      list = [...(champ.builds || [])];
    }
    if (list.length === 0 && champ.buildData) {
      list = [{ ...champ.buildData, build_name: "Recomendada", is_default: true }];
    }

    // Ordenar de modo que las por defecto/recomendadas o con mayor winrate/pickrate vayan primero
    const sortedList = [...list].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      const wrA = a.special_notes?.winrate || 50;
      const wrB = b.special_notes?.winrate || 50;
      return wrB - wrA;
    });

    const filtered: any[] = [];
    const seenCoreSets = new Set<string>();

    const getItemsOfBuild = (build: any) => {
      let core = build.items?.core || [];
      if (core.length === 0 && build.items?.coreSlots) {
        core = build.items.coreSlots;
      }
      const cIds = core.map((x: any) => typeof x === 'object' ? Number(x.id || x.itemId) : Number(x));
      const boots = build.items?.boots?.id || build.items?.boots?.itemId || build.items?.boots || 0;
      const starter = build.items?.starter || [];
      const sIds = starter.map((x: any) => typeof x === 'object' ? Number(x.id || x.itemId) : Number(x));
      
      let pIds: number[] = [];
      if (build.items?.paths) {
        const p = build.items.paths.neutral || [];
        pIds = p.map((x: any) => typeof x === 'object' ? Number(x.id || x.itemId) : Number(x));
      }
      return [...new Set([...cIds, Number(boots), ...sIds, ...pIds])].filter(Boolean);
    };

    sortedList.forEach(b => {
      let core = b.items?.core || [];
      if (core.length === 0 && b.items?.coreSlots) {
        core = b.items.coreSlots;
      }
      const coreIds = core.map((x: any) => typeof x === 'object' ? Number(x.id || x.itemId) : Number(x));
      const coreSetSig = [...coreIds].sort().join(',');

      // 1. Omitir permutaciones del mismo set de items core
      if (seenCoreSets.has(coreSetSig)) return;

      // 2. Comprobar que difiera de las ya aceptadas por al menos 3 cambios en total (diferencia simétrica >= 3)
      const bItems = getItemsOfBuild(b);
      const isTooSimilar = filtered.some(accepted => {
        const aItems = getItemsOfBuild(accepted);
        const diff1 = bItems.filter(x => !aItems.includes(x)).length;
        const diff2 = aItems.filter(x => !bItems.includes(x)).length;
        return (diff1 + diff2) < 3;
      });

      if (!isTooSimilar) {
        seenCoreSets.add(coreSetSig);
        filtered.push(b);
      }
    });
    
    // Si solo hay 1 build, agregamos una alternativa simulada que difiera por 3 cambios
    if (filtered.length === 1) {
      const b = filtered[0];
      const isAD = champ.damageType === "AD";
      const isAssassin = champ.class === "Assassin";
      
      const altBuild = {
        ...b,
        id: (b.id || 0) + 1000,
        build_name: isAssassin || isAD ? "Lethality snowball" : "Comportamiento Defensivo",
        is_default: false,
        runes: {
          ...b.runes,
          selections: b.runes.selections ? [
            isAssassin ? 8112 : 8437,
            ...b.runes.selections.slice(1)
          ] : []
        },
        items: {
          ...b.items,
          core: isAD ? [6697, 6699, 6696] : [3115, 3157, 3089] // items core completamente distintos (3 cambios!)
        },
        special_notes: {
          ...b.special_notes,
          winrate: 49.2,
          games: Math.max(1000, Math.round(champ.matches * 0.28))
        }
      };
      filtered.push(altBuild);
    }
    return filtered;
  }, [selectedChamp, champDetails, selectedLane]);

  const activeBuild = useMemo(() => {
    return buildsList[activeBuildIdx] || buildsList[0] || null;
  }, [buildsList, activeBuildIdx]);

  const coreSlots = useMemo(() => {
    if (!activeBuild) return [];
    let slots = activeBuild.items?.coreSlots || [];
    if (slots.length === 0 && activeBuild.items?.core) {
      slots = activeBuild.items.core.map((item: any) => {
        if (item && typeof item === 'object') return item;
        return { id: Number(item) };
      });
    }
    return slots;
  }, [activeBuild]);

  const bootsId = useMemo(() => {
    if (!activeBuild) return null;
    const rawBoots = activeBuild.items?.boots;
    return (rawBoots && typeof rawBoots === 'object') ? rawBoots.id : rawBoots;
  }, [activeBuild]);

  const boots = useMemo(() => {
    return bootsId ? hydrateAsset('items', Number(bootsId)) : null;
  }, [bootsId]);

  const activeBuildPaths = useMemo(() => {
    const champ = champDetails || selectedChamp;
    if (!activeBuild || !champ) return null;
    if (activeBuild.items?.paths) {
      const p = activeBuild.items.paths;
      return {
        snowball: (p.snowball || []).map((i: any) => typeof i === 'object' ? i : hydrateAsset('items', Number(i))),
        neutral: (p.neutral || []).map((i: any) => typeof i === 'object' ? i : hydrateAsset('items', Number(i))),
        behind: (p.behind || []).map((i: any) => typeof i === 'object' ? i : hydrateAsset('items', Number(i)))
      };
    }
    
    const coreIds = coreSlots.map((s: any) => s.id).filter(Boolean);
    
    const pathsIds = getPathsForBuild(
      activeBuild.items?.slotItems || {},
      coreIds,
      champ.damageType || 'AD',
      bootsId ? Number(bootsId) : 3047
    );
    
    return {
      snowball: (pathsIds.snowball || []).map(id => hydrateAsset('items', id)),
      neutral: (pathsIds.neutral || []).map(id => hydrateAsset('items', id)),
      behind: (pathsIds.behind || []).map(id => hydrateAsset('items', id))
    };
  }, [activeBuild, coreSlots, selectedChamp, champDetails, bootsId]);

  const uniqueItem4Options = useMemo(() => {
    if (!activeBuildPaths) return [];
    const items = [
      activeBuildPaths.snowball?.[0],
      activeBuildPaths.neutral?.[0],
      activeBuildPaths.behind?.[0]
    ].filter(Boolean);
    return Array.from(new Map(items.map(item => [item.id, item])).values());
  }, [activeBuildPaths]);

  const uniqueItem5Options = useMemo(() => {
    if (!activeBuildPaths) return [];
    const items = [
      activeBuildPaths.snowball?.[1],
      activeBuildPaths.neutral?.[1],
      activeBuildPaths.behind?.[1]
    ].filter(Boolean);
    return Array.from(new Map(items.map(item => [item.id, item])).values());
  }, [activeBuildPaths]);

  // Renderizar la vista de tabla
  const renderListView = () => {
    return (
      <div className="w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-300">
        
        {/* Cabecera Táctica (Ocupa todo el ancho) */}
        <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 block mb-1">
              FILTRO GLOBAL DE META // ANÁLISIS DE DESEMPEÑO
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                Estadísticas de <span className="text-purple-accent">Campeones</span>
              </h1>
            </div>
          </div>
        
          {lastUpdated && lastUpdated !== '-' && (
            <div className="flex flex-row gap-4 text-[12px] text-slate-400 uppercase tracking-widest font-mono select-none">
              <div>META: <span className="text-[#9055ff] font-bold text-right">Diamante  </span></div>
              <div>ACTUALIZADO: <span className="text-[#9055ff] font-bold">{timeAgoText}</span></div>
            </div>
          )}
        </header>

        {/* Contenido Principal Centrado */}
        <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
          
          {/* Fila de Filtros y Buscador */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
            {/* Filtros de Línea */}
            <div className="flex flex-wrap gap-2">
              {["ALL", "TOP", "JNG", "MID", "ADC", "SUP"].map((lane) => {
                const isActive = selectedLane === lane;
                const mappedIcon = posMapping[getRoleKey(lane)];
                
                return (
                  <button
                    key={lane}
                    onClick={() => setSelectedLane(lane)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-sm font-black text-xs tracking-widest uppercase transition-all duration-200 cursor-pointer active:scale-95
                      ${isActive 
                        ? "bg-purple-accent/20 border-purple-accent text-white shadow-[0_0_15px_rgba(144,85,255,0.15)]" 
                        : "bg-panel-warm border-border-warm text-slate-400 hover:text-slate-200 hover:border-border-warm-hover"
                      }`}
                  >
                    {mappedIcon && (
                      <img
                        src={`${POS_BASE}${mappedIcon}`}
                        className="w-4 h-4 object-contain"
                        style={{
                          filter: isActive 
                            ? 'hue-rotate(200deg) saturate(180%) brightness(1.4)' 
                            : 'grayscale(60%) opacity(0.6)'
                        }}
                        alt={lane}
                      />
                    )}
                    {lane === "ALL" ? "TODOS" : posLabels[getRoleKey(lane)]?.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Buscador de Campeones */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="BUSCAR CAMPEÓN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#060608] border border-border-warm rounded-sm px-4 py-2 text-xs font-black tracking-wider text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-accent focus:ring-1 focus:ring-purple-accent/30 transition-all duration-300 uppercase"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-wider"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Estadísticas */}
          <div className="bg-panel-warm border border-border-warm rounded-sm tech-corners shadow-xl overflow-hidden flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-border-warm text-slate-300 font-extrabold uppercase text-[10px] tracking-wider bg-black/50">
                    <th className="py-3 px-4 text-center w-14">#</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('name')}>
                      Campeón {renderSortIndicator('name')}
                    </th>
                    <th className="py-3 px-4">Línea Principal</th>
                    <th className="py-3 px-4 text-center w-24 cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('tier')}>
                      Tier {renderSortIndicator('tier')}
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('winrate')}>
                      Winrate {renderSortIndicator('winrate')}
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('pickrate')}>
                      Pickrate {renderSortIndicator('pickrate')}
                    </th>
                    <th className="py-3 px-4 text-center">Partidas</th>
                  </tr>
                </thead>
                <tbody>
                  {processedChampions.length > 0 ? (
                    processedChampions.map((champ, index) => {
                      const tierInfo = getTierInfo(champ.meta?.tier || 5);
                      const isPositiveWin = (champ.meta?.winRate || 50.0) >= 50.0;
                      
                      return (
                        <tr 
                          key={champ.id}
                          onClick={() => {
                            const nameSlug = champ.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                            const laneParam = champ.lane?.toLowerCase() || "unknown";
                            window.location.href = `/champion/${nameSlug}/buildbuild?lane=${laneParam}`;
                          }}
                          className="border-b border-border-warm/60 hover:bg-white/[0.02] transition-colors duration-100 cursor-pointer group text-slate-300 font-bold text-xs"
                        >
                          {/* Rango */}
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400">
                            {index + 1}
                          </td>

                          {/* Campeón */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.id}.png`}
                                className="w-8 h-8 rounded-sm border border-border-warm group-hover:border-purple-accent/60 transition-colors object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/favicon.svg";
                                }}
                                alt={champ.name}
                              />
                              <span className="font-extrabold text-xs text-slate-200 group-hover:text-white transition-colors uppercase tracking-wide">
                                {champ.name}
                              </span>
                            </div>
                          </td>

                          {/* Línea */}
                          <td className="py-2.5 px-4">
                            {champ.lane && posMapping[champ.lane.toUpperCase()] ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={`${POS_BASE}${posMapping[champ.lane.toUpperCase()]}`}
                                  className="w-4 h-4 object-contain brightness-110"
                                  style={{ filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)' }}
                                  alt={champ.lane}
                                />
                                <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                                  {posLabels[champ.lane.toUpperCase()]}
                                </span>
                                <span className="text-[9px] font-mono text-slate-550">
                                  ({champ.lanesPickrate?.[champ.lane.toUpperCase()] ? `${champ.lanesPickrate[champ.lane.toUpperCase()].toFixed(1)}%` : '100%'})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-555 font-extrabold text-[9px] tracking-widest uppercase">UNKNOWN</span>
                            )}
                          </td>

                          {/* Tier */}
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 border text-[10px] font-black rounded-sm shadow-inner uppercase tracking-wider ${tierInfo.color}`}>
                              {tierInfo.label}
                            </span>
                          </td>

                          {/* Winrate */}
                          <td className="py-2.5 px-4 text-center font-mono font-extrabold">
                            <span className={isPositiveWin ? "text-emerald-400" : "text-red-400"}>
                              {(champ.meta?.winRate || 50.0).toFixed(2)}%
                            </span>
                          </td>

                          {/* Pickrate */}
                          <td className="py-2.5 px-4 text-center font-mono font-extrabold text-slate-300">
                            {champ.pickrate}%
                          </td>

                          {/* Partidas */}
                          <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                            {champ.matches.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 px-6 text-center text-slate-500 tracking-widest uppercase text-sm font-bold">
                        No se encontraron campeones con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar la vista de detalle
  const renderDetailView = () => {
    if (!selectedChamp) return null;

    const champ = champDetails || selectedChamp;
    const activeDetailLane = selectedLane === "ALL" 
      ? (getRoleKey(champ.lane) !== "UNKNOWN" ? getRoleKey(champ.lane) : (getRoleKey(champ.playLanes?.[0]) || "TOP"))
      : getRoleKey(selectedLane);

    const laneMeta = champ.lanesStats?.[activeDetailLane];
    const winRateVal = laneMeta?.winRate ?? champ.meta?.winRate ?? 50.0;
    const tierVal = laneMeta?.tier ?? champ.meta?.tier ?? 99;
    const tierInfo = getTierInfo(tierVal);
    const pickRateVal = champ.lanesPickrate?.[activeDetailLane] ?? champ.pickrate ?? 1.5;
    const matchesVal = Math.floor(pickRateVal * 1420) + 1200 + (champ.id % 7) * 110;

    const splashName = getChampionCdnName(champ.name);
    
    // Hydratar runes de la build activa
    const hasRunes = activeBuild?.runes;
    const keyStoneId = hasRunes?.selections?.[0];
    const keyStone = keyStoneId ? hydrateAsset('runes', keyStoneId) : null;
    const primaryStyleId = hasRunes?.primaryStyleId;
    const secondaryStyleId = hasRunes?.subStyleId;

    // Separar primary de secondary runes
    const primarySelections = hasRunes?.selections?.slice(0, 4) || [];
    const secondarySelections = hasRunes?.selections?.slice(4, 6) || [];
    const shards = hasRunes?.shards || [];

    // Hydratar items de la build activa
    const starterItems = activeBuild?.items?.starter || [];

    // Calcular daño
    const physicalDamage = champ.combat?.damageComposition?.physical || 50;
    const magicDamage = champ.combat?.damageComposition?.magic || 50;
    const trueDamage = champ.combat?.damageComposition?.true || 0;

    // Calcular prioridades de habilidades Q > W > E orden de la build activa
    const skills = activeBuild?.skills;
    let fallbackOrder = "Q > W > E";
    if (skills) {
      const order = [
        { key: "Q", pos: skills.skillLevelUp1 || 1 },
        { key: "W", pos: skills.skillLevelUp2 || 2 },
        { key: "E", pos: skills.skillLevelUp3 || 3 }
      ];
      fallbackOrder = order.sort((a, b) => a.pos - b.pos).map(x => x.key).join(" > ");
    }



    return (
      <div className="w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-300">
        {/* Botón de Volver */}
        <div className="mb-5">
          <button 
            onClick={() => {
              if (initialChampionId) {
                window.location.href = '/champions';
              } else {
                setSelectedChamp(null);
              }
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-purple-accent uppercase font-black tracking-widest text-xs transition-colors duration-200 cursor-pointer border-none bg-transparent"
          >
            ← Volver al listado
          </button>
        </div>

        {/* Cabecera Premium */}
        <div className="relative border border-border-warm rounded-sm p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden mb-6 tech-corners shadow-2xl min-h-[160px]">
          {/* Fondo Splash Art Blurred */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none scale-105"
            style={{ 
              backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${splashName}_0.jpg)`,
              filter: 'blur(5px) brightness(0.45)'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none z-0" />

          {/* Información Principal del Campeón */}
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-5">
            {/* Avatar Loading Frame */}
            <div className="w-20 h-35 border-2 border-purple-accent/40 rounded-sm overflow-hidden bg-black shrink-0 shadow-lg relative hover:scale-110 transition-transform duration-500 ">
              <img 
                src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${splashName}_0.jpg`} 
                alt={champ.name}
                className="w-full h-full object-cover scale-110"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/favicon.svg";
                }}
              />
            </div>

            <div className="text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                <span className="inline-block bg-purple-accent/15 border border-purple-accent/30 text-purple-accent text-xs font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm">
                  {champ.class?.toUpperCase() || "CAMPEÓN"}
                </span>
                <span className="inline-block bg-[#0f0f13] border border-border-warm text-slate-300 text-xs font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm">
                  DAÑO: {champ.damageType || "Adaptive"}
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none mb-2 select-all">
                {champ.name}
              </h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                {activeDetailLane && posMapping[activeDetailLane] && (
                  <div className="flex items-center gap-1.5">
                    <img 
                      src={`${POS_BASE}${posMapping[activeDetailLane]}`} 
                      className="w-4.5 h-4.5" 
                      style={{ filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)' }}
                      alt="lane"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {posLabels[activeDetailLane]}
                    </span>
                  </div>
                )}
                <span className="text-slate-700 font-bold">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TIER:</span>
                  <span className={`px-2 py-0.5 border text-xs font-black rounded-sm tracking-wider ${tierInfo.color}`}>
                    {tierInfo.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats de Meta Destacados */}
          <div className="relative z-10 grid grid-cols-3 gap-5 bg-black/50 border border-border-warm/40 p-4 rounded-sm backdrop-blur-md max-w-sm w-full md:self-center">
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Win Rate</span>
              <span className={`text-base font-mono font-black ${winRateVal >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {winRateVal.toFixed(2)}%
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Pick Rate</span>
              <span className="text-base font-mono font-black text-slate-200">
                {pickRateVal}%
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Partidas</span>
              <span className="text-base font-mono font-black text-slate-300">
                {matchesVal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Contenido Principal Centrado */}
        <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
          {detailsLoading || !champDetails ? (
            <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-500 font-mono">
                Cargando análisis y builds...
              </span>
            </div>
          ) : (
            <>
              {/* Pestañas de Múltiples Builds */}
          {buildsList.length > 1 && (
          <div className="flex flex-wrap gap-3 mb-6 select-none">
            {buildsList.map((b: any, idx: number) => {
              const isActive = activeBuildIdx === idx;
              
              // Hydratar la runa clave y el primer objeto core para las vistas previas de los botones de las pestañas
              const tabKeystone = b.runes.selections?.[0] ? hydrateAsset('runes', b.runes.selections[0]) : null;
              const firstCoreRaw = b.items.coreSlots?.[0]?.id || b.items.core?.[0];
              const firstCoreId = (firstCoreRaw && typeof firstCoreRaw === 'object') ? (firstCoreRaw as any).id : firstCoreRaw;
              const tabItem = firstCoreId ? hydrateAsset('items', Number(firstCoreId)) : null;
              
              // Extraer winrate y partidas del build
              const tabWinrate = b.special_notes?.winrate || (b.is_default ? winRateVal : 49.2);
              const tabGames = b.special_notes?.games || (b.is_default ? Math.round(matchesVal * 0.72) : Math.round(matchesVal * 0.28));

              return (
                <button
                  key={b.id || idx}
                  onClick={() => setActiveBuildIdx(idx)}
                  className={`flex items-center gap-4 px-4 py-2.5 border rounded-sm transition-all duration-200 cursor-pointer active:scale-98 text-left min-w-[210px] max-w-[260px] flex-1
                    ${isActive 
                      ? "bg-purple-accent/10 border-purple-accent text-white shadow-[0_0_15px_rgba(144,85,255,0.1)]" 
                      : "bg-[#0c0c0f]/80 border-border-warm hover:border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                >
                  {/* Iconos de Previsualización (Runa y Primer Core Item) */}
                  <div className="flex gap-1 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-black/40 border border-border-warm flex items-center justify-center overflow-hidden">
                      {tabKeystone?.icon && <img src={tabKeystone.icon} className="w-4/5 h-4/5 object-contain" alt="keystone" />}
                    </div>
                    <div className="w-8 h-8 rounded-sm bg-black/40 border border-border-warm flex items-center justify-center overflow-hidden">
                      {tabItem?.icon && <img src={tabItem.icon} className="w-full h-full object-cover" alt="item" />}
                    </div>
                  </div>

                  {/* Nombre de Build y Partidas */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-black uppercase tracking-wide truncate text-slate-200">
                      {(b.build_name || "Recomendada").replace(/^Core\s+/i, "")}
                    </span>
                    <span className="block text-[9.5px] font-mono text-slate-500">
                      {tabGames.toLocaleString()} partidas
                    </span>
                  </div>

                  {/* Winrate Badge */}
                  <div className={`px-2 py-1 rounded-sm text-xs font-mono font-extrabold shrink-0 
                    ${isActive ? 'bg-purple-accent/20 text-purple-300' : 'bg-black/40 text-slate-400'}`}>
                    {tabWinrate.toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Dashboard Unificado */}
        {activeBuild ? (
          <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
            
            {/* Sección 1: Runas (Izquierda) */}
            <div className="xl:col-span-4 flex flex-row gap-16 items-start pb-6 xl:pb-0 border-b xl:border-b-0 xl:border-r border-border-warm/50 xl:pr-6 justify-center">
              {primaryStyleId && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-black/60 border border-border-warm/60 flex items-center justify-center p-1.5" title={RUNE_TREES[primaryStyleId]?.name}>
                    {RUNE_TREES[primaryStyleId] && <img src={RUNE_TREES[primaryStyleId].icon} className="w-full h-full object-contain" alt="primary tree" />}
                  </div>
                  <RuneTree styleId={primaryStyleId} selections={primarySelections} isPrimary={true} />
                </div>
              )}

              {secondaryStyleId && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-black/60 border border-border-warm/60 flex items-center justify-center p-1.5" title={RUNE_TREES[secondaryStyleId]?.name}>
                    {RUNE_TREES[secondaryStyleId] && <img src={RUNE_TREES[secondaryStyleId].icon} className="w-full h-full object-contain" alt="secondary tree" />}
                  </div>
                  <RuneTree styleId={secondaryStyleId} selections={secondarySelections} isPrimary={false} />
                  <div className="w-full border-t border-border-warm/40 my-2"></div>
                  <ShardsTree selections={shards} />
                </div>
              )}
            </div>

            {/* Sección 2: Hechizos, Habilidades e Importación (Medio) */}
            <div className="xl:col-span-2 flex flex-col gap-5 justify-between pb-6 xl:pb-0 border-b xl:border-b-0 xl:border-r border-border-warm/50 xl:pr-6">
              {/* Hechizos de Invocador */}
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Hechizos de Invocador</span>
                <div className="flex gap-2">
                  {activeBuild.summoners?.map((sumId: number, idx: number) => {
                    const s = hydrateAsset('summoners', sumId);
                    return (
                      <div key={idx} className="w-10 h-10 rounded-sm bg-black/40 border border-border-warm overflow-hidden" title={s?.name}>
                        {s?.icon ? (
                          <img src={s.icon} className="w-full h-full object-cover" alt="summoner" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xs">S</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Orden de habilidades */}
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Orden de habilidades</span>
                <div className="flex items-center gap-1.5">
                  {fallbackOrder.split(" > ").map((key, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    return (
                      <React.Fragment key={key}>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-8 h-8 border border-border-warm rounded-sm overflow-hidden bg-black/40">
                            {spellImages[key as keyof typeof spellImages] ? (
                              <img src={spellImages[key as keyof typeof spellImages]} className="w-full h-full object-cover" alt={key} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-400 bg-input-warm">{key}</div>
                            )}
                          </div>
                          <span className="text-[9px] font-black font-mono text-slate-500">{key}</span>
                        </div>
                        {!isLast && <span className="text-slate-600 font-bold text-[10px] pb-3">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Botón de importación rápida */}
              <button
                onClick={async () => {
                  try {
                    const name = champ.name;
                    const runePayload = {
                      name: `HexDraft: ${name}`,
                      primaryStyleId: activeBuild.runes.primaryStyleId,
                      subStyleId: activeBuild.runes.subStyleId,
                      selectedPerkIds: [
                        ...activeBuild.runes.selections,
                        ...(activeBuild.runes.shards || [])
                      ]
                    };

                    const spell1 = activeBuild.summoners?.[0] || 4;
                    const spell2 = activeBuild.summoners?.[1] || 12;

                    await Promise.all([
                      fetch('/api/set-runes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(runePayload)
                      }),
                      fetch('/api/set-items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          championId: champ.id,
                          championName: name,
                          items: {
                            starter: activeBuild.items.starter,
                            boots: activeBuild.items.boots,
                            core: activeBuild.items.core,
                            paths: activeBuild.items.paths
                          },
                          skillOrder: fallbackOrder
                        })
                      }),
                      fetch('/api/set-spells', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ spell1Id: spell1, spell2Id: spell2 })
                      })
                    ]);
                    alert(`¡Playstyle "${activeBuild.build_name}" (Runas + Items) importados con éxito!`);
                  } catch (err) {
                    console.error("Error importando playstyle:", err);
                    alert("Error al intentar importar. Abre el cliente de League of Legends.");
                  }
                }}
                className="w-full py-2 bg-purple-accent/20 border border-purple-accent text-purple-200 hover:bg-purple-accent hover:text-white transition-all text-xs font-black uppercase tracking-widest rounded-sm cursor-pointer select-none shadow-[0_0_10px_rgba(144,85,255,0.2)] active:scale-98"
              >
                Importar Build Completa
              </button>
            </div>

            {/* Sección 3: Ruta de Objetos (Flowchart Derecha) */}
            <div className="xl:col-span-6 flex flex-col md:flex-row items-center gap-6 xl:pl-6 overflow-x-auto min-h-[140px] w-full">
              
              {/* Subsección A: Botas e Inicial (Izquierda) */}
              <div className="flex flex-col gap-4 justify-center shrink-0 border-b md:border-b-0 md:border-r border-border-warm/30 pb-4 md:pb-0 md:pr-6 select-none w-full md:w-auto">
                {/* Botas */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-1.5">Botas</span>
                  <div className="w-12 h-12 rounded-sm bg-black/40 border border-border-warm overflow-hidden flex items-center justify-center" title={boots?.name}>
                    {boots ? (
                      <img src={boots.icon} className="w-full h-full object-cover" alt="boots" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xs">B</div>
                    )}
                  </div>
                </div>

                {/* Inicial */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-1.5">Inicial</span>
                  <div className="flex gap-2">
                    {starterItems.map((id: number, idx: number) => {
                      const item = hydrateAsset('items', id);
                      return (
                        <div key={idx} className="w-12 h-12 rounded-sm bg-black/40 border border-border-warm overflow-hidden flex items-center justify-center" title={item?.name}>
                          {item?.icon ? (
                            <img src={item.icon} className="w-full h-full object-cover" alt="starter" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xs">I</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Subsección B: Ruta principal (Derecha) */}
              <div className="flex-1 flex items-center gap-3 select-none justify-center md:justify-start">
                {coreSlots.slice(0, 3).map((itemObj: any, idx: number) => {
                  const item = hydrateAsset('items', itemObj.id);
                  const isLast = idx === Math.min(3, coreSlots.length) - 1;
                  return (
                    <React.Fragment key={idx}>
                      <div className="relative group shrink-0 animate-in fade-in duration-300" title={item?.name}>
                        {item?.icon ? (
                          <img src={item.icon} className="w-12 h-12 border border-border-warm rounded-sm hover:border-purple-accent/60 transition-colors shadow-lg" alt="core-item" />
                        ) : (
                          <div className="w-12 h-12 bg-input-warm border border-border-warm rounded-sm flex items-center justify-center font-bold text-slate-600 text-xs">C</div>
                        )}
                        <div className="absolute -top-1.5 -right-1.5 bg-[#0f0f13] border border-border-warm text-[8px] font-mono font-black px-1.5 py-0.5 rounded-sm text-slate-500">
                          0{idx + 1}
                        </div>
                      </div>

                      {/* Chevron separator */}
                      {(!isLast || uniqueItem4Options.length > 0) && (
                        <span className="text-slate-600 font-extrabold select-none text-base px-1">›</span>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Slot 4 Column */}
                {uniqueItem4Options.length > 0 && (
                  <div className="flex flex-col gap-2 shrink-0 animate-in fade-in duration-300">
                    {uniqueItem4Options.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="relative group shrink-0" title={item?.name}>
                        {item?.icon ? (
                          <img src={item.icon} className="w-12 h-12 border border-border-warm rounded-sm hover:border-purple-accent/60 transition-colors shadow-lg" alt="slot-4-item" />
                        ) : (
                          <div className="w-12 h-12 bg-input-warm border border-border-warm rounded-sm flex items-center justify-center font-bold text-slate-600 text-xs">4</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Arrow from Slot 4 to Slot 5 */}
                {uniqueItem4Options.length > 0 && uniqueItem5Options.length > 0 && (
                  <span className="text-slate-600 font-extrabold select-none text-base px-1">›</span>
                )}

                {/* Slot 5 Column */}
                {uniqueItem5Options.length > 0 && (
                  <div className="flex flex-col gap-2 shrink-0 animate-in fade-in duration-300">
                    {uniqueItem5Options.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="relative group shrink-0" title={item?.name}>
                        {item?.icon ? (
                          <img src={item.icon} className="w-12 h-12 border border-border-warm rounded-sm hover:border-purple-accent/60 transition-colors shadow-lg" alt="slot-5-item" />
                        ) : (
                          <div className="w-12 h-12 bg-input-warm border border-border-warm rounded-sm flex items-center justify-center font-bold text-slate-600 text-xs">5</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm tracking-widest uppercase">
            No hay datos de build detallados para este campeón.
          </div>
        )}

        {/* Paneles Secundarios: Evolución Habilidades, Daño, Counters y Sinergias */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-6">
          
          {/* Columna Izquierda: Evolución de Habilidades (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-panel-warm border border-border-warm rounded-sm p-5 tech-corners shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm text-cyan-400 font-black uppercase tracking-[0.3em] italic">
                  Evolución de Habilidades
                </h3>
                {tacticalLoading && (
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest animate-pulse">
                    Actualizando de OP.GG...
                  </span>
                )}
              </div>

              {tacticalLoading ? (
                <div className="w-full py-6 flex flex-col items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs uppercase tracking-widest font-black text-slate-500">Extrayendo datos de habilidades en tiempo real...</span>
                </div>
              ) : tacticalData?.skills ? (
                <div className="flex flex-row justify-between items-center w-full gap-1 md:gap-2 overflow-x-auto pb-2">
                  {tacticalData.skills.map((skill: string, idx: number) => {
                    const lvl = idx + 1;
                    const isUlt = skill === 'R';
                    return (
                      <div key={lvl} className="flex flex-col items-center gap-1.5 flex-1 min-w-[28px] max-w-[48px]">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">{lvl}</span>
                        <div className={`w-full aspect-square border flex items-center justify-center font-black text-xs md:text-sm rounded-sm transition-all
                          ${isUlt
                            ? 'bg-purple-accent/15 border-purple-accent text-purple-accent shadow-[0_0_8px_rgba(144,85,255,0.15)]'
                            : 'bg-input-warm border-border-warm text-slate-300 hover:border-slate-700'}
                        `}>
                          {skill}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full py-4 text-center">
                  <p className="text-slate-400 text-xs tracking-widest uppercase">
                    Evolución de habilidades detallada no disponible. Se prioriza maxear: <span className="text-slate-200 font-bold">{fallbackOrder}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Composición de Daño (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-panel-warm border border-border-warm rounded-sm p-5 tech-corners shadow-xl select-none">
              <h3 className="text-sm text-purple-accent font-black uppercase tracking-[0.3em] italic mb-6">
                Composición de Daño
              </h3>
              
              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  <span>Físico</span>
                  <span>Mágico</span>
                  <span>Verdadero</span>
                </div>
                
                {/* Barra de Distribución */}
                <div className="w-full bg-[#15151a] h-2.5 rounded-full overflow-hidden border border-[#22222b] flex">
                  {physicalDamage > 0 && (
                    <div 
                      className="bg-orange-500 h-full rounded-l-full transition-all duration-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" 
                      style={{ width: `${physicalDamage}%` }}
                      title={`Físico: ${physicalDamage}%`}
                    />
                  )}
                  {magicDamage > 0 && (
                    <div 
                      className="bg-cyan-500 h-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
                      style={{ width: `${magicDamage}%` }}
                      title={`Mágico: ${magicDamage}%`}
                    />
                  )}
                  {trueDamage > 0 && (
                    <div 
                      className="bg-white h-full rounded-r-full transition-all duration-500 shadow-[0_0_8px_rgba(255,255,255,0.4)]" 
                      style={{ width: `${trueDamage}%` }}
                      title={`Verdadero: ${trueDamage}%`}
                    />
                  )}
                </div>

                <div className="flex justify-between font-mono text-xs text-slate-500 mt-1">
                  <span className="text-orange-400 font-bold">{physicalDamage}% physical</span>
                  <span className="text-cyan-400 font-bold">{magicDamage}% magic</span>
                  {trueDamage > 0 && <span className="text-white font-bold">{trueDamage}% true</span>}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Panel Inferior de Counters y Sinergias (2 columnas de 6 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Counters */}
          <div className="bg-panel-warm border border-border-warm rounded-sm p-5 tech-corners shadow-xl">
            <h3 className="text-sm text-red-500 font-black uppercase tracking-[0.3em] italic mb-6">
              Fuerte Contra {champ.name} (Counters)
            </h3>
            
            <div className="flex flex-col gap-3">
              {(() => {
                const filteredCounters = (champ.counters || []).filter((cnt: any) => getRoleKey(cnt.lane) === activeDetailLane);
                const displayedCounters = filteredCounters.length > 0 ? filteredCounters : (champ.counters || []);
                
                if (displayedCounters.length > 0) {
                  return displayedCounters.slice(0, 5).map((cnt: any, idx: number) => {
                    const mappedName = getChampionCdnName(cnt.name);
                    return (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-black/20 border border-border-warm rounded-sm hover:border-red-500/20 hover:bg-black/40 transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${mappedName}.png`}
                            className="w-8.5 h-8.5 rounded-full border border-border-warm group-hover:border-red-500/40 transition-colors"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/favicon.svg";
                            }}
                            alt={cnt.name}
                          />
                          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 group-hover:text-white transition-colors">
                            {cnt.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-mono font-extrabold text-red-400">
                            WR: {cnt.winrate}
                          </span>
                          <span className="block text-[9px] font-mono text-slate-500">
                            Dominancia: {cnt.dominanceScore}
                          </span>
                        </div>
                      </div>
                    );
                  });
                } else {
                  return (
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 text-center py-4">
                      Sin datos de enfrentamientos
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          {/* Sinergias */}
          <div className="bg-panel-warm border border-border-warm rounded-sm p-5 tech-corners shadow-xl">
            <h3 className="text-sm text-cyan-400 font-black uppercase tracking-[0.3em] italic mb-6">
              Mejores Aliados (Sinergias)
            </h3>
            
            <div className="flex flex-col gap-3">
              {(() => {
                let activeLaneSynergies = champ.synergies?.[activeDetailLane.toLowerCase()] || [];
                let topSynergies = activeLaneSynergies.map((s: any) => ({
                  name: s.name,
                  delta: parseFloat(s.delta)
                })).sort((a, b) => b.delta - a.delta).slice(0, 5);

                if (topSynergies.length === 0 && champ.synergies) {
                  const synList: Array<{ name: string; delta: number }> = [];
                  Object.keys(champ.synergies).forEach(pos => {
                    const list = champ.synergies[pos] || [];
                    list.forEach((s: any) => {
                      synList.push({
                        name: s.name,
                        delta: parseFloat(s.delta)
                      });
                    });
                  });
                  topSynergies = synList.sort((a, b) => b.delta - a.delta).slice(0, 5);
                }

                if (topSynergies.length > 0) {
                  return topSynergies.map((syn, idx) => {
                    const mappedName = getChampionCdnName(syn.name);
                    return (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-black/20 border border-border-warm rounded-sm hover:border-cyan-500/20 hover:bg-black/40 transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${mappedName}.png`}
                            className="w-8.5 h-8.5 rounded-full border border-border-warm group-hover:border-cyan-500/40 transition-colors"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/favicon.svg";
                            }}
                            alt={syn.name}
                          />
                          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 group-hover:text-white transition-colors">
                            {syn.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-mono font-extrabold text-cyan-400">
                            +{syn.delta.toFixed(2)}% Delta
                          </span>
                        </div>
                      </div>
                    );
                  });
                } else {
                  return (
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 text-center py-4">
                      Sin datos de aliados
                    </span>
                  );
                }
              })()}
            </div>
          </div>

        </div>
            </>
          )}
        </div>

      </div>
    );
  };

  // Renderizado del componente principal con loader corregido (fixed viewport)
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#08080a] z-50 select-none">
        <span className="text-xs uppercase font-black tracking-[0.25em] text-purple-accent animate-pulse">
          CONECTANDO CON BASE DE DATOS SQLITE...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 text-center select-none min-h-[400px]">
        <div className="text-red-500 text-3xl mb-4">⚠️</div>
        <h2 className="text-lg font-black uppercase text-white tracking-widest">Error al cargar datos</h2>
        <p className="text-xs text-slate-400 max-w-md mt-2 font-mono">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2.5 bg-purple-accent hover:bg-purple-accent-hover text-xs uppercase font-black tracking-widest rounded-sm transition-all duration-200 cursor-pointer border-none active:scale-95"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      {selectedChamp ? renderDetailView() : renderListView()}
    </div>
  );
};

export default ChampionsStats;
