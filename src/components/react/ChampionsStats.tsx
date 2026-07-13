import React, { useState, useEffect, useMemo } from 'react';
import META_CACHE from '../../lib/data/meta-cache.json';
import { getChampionCdnName } from '../../lib/championMapper';
import type { Champion } from './champions/types';
import { 
  getEnrichedChampionsFromMeta, 
  getRoleKey, 
  laneToMetaKey, 
  normalizeKey, 
  formatTimeAgo 
} from './champions/utils';
import { ChampionList } from './champions/ChampionList';
import { ChampionDetail } from './champions/ChampionDetail';

export const ChampionsStats = ({ 
  initialChampionId, 
  initialLane 
}: { 
  initialChampionId?: number; 
  initialLane?: string; 
}) => {
  // Convertir CHAMPIONS_DB a array y enriquecerlo de forma básica para carga instantánea
  const initialChamps = useMemo(() => {
    return getEnrichedChampionsFromMeta(META_CACHE);
  }, []);

  // Estados de datos
  const [champions, setChampions] = useState<Champion[]>(initialChamps);
  const [loading] = useState(false); // Carga instantánea desde JSON
  const [error] = useState<string | null>(null);
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
  const [selectedChamp, setSelectedChamp] = useState<Champion | null>(() => {
    if (initialChampionId) {
      return initialChamps.find((c: Champion) => c.id === initialChampionId) || null;
    }
    return null;
  });
  const [champDetails, setChampDetails] = useState<Champion | null>(null);
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

  // Cargar detalles específicos del campeón seleccionado
  useEffect(() => {
    if (!selectedChamp) {
      queueMicrotask(() => setChampDetails(null));
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
      queueMicrotask(() => setTimeAgoText('Nunca'));
      return;
    }
    
    const updateText = () => {
      setTimeAgoText(formatTimeAgo(lastUpdated));
    };
    
    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Polling de /api/meta cada 60 segundos
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

  // Cargar datos tácticos detallados cuando se selecciona un campeón
  useEffect(() => {
    if (!selectedChamp) {
      queueMicrotask(() => setTacticalData(null));
      return;
    }

    queueMicrotask(() => setActiveBuildIdx(0)); // Reset a la build recomendada por defecto
    const loadTactical = async () => {
      setTacticalLoading(true);
      try {
        const activeDetailLane = selectedLane === "ALL" 
          ? (getRoleKey(selectedChamp.lane) !== "UNKNOWN" ? getRoleKey(selectedChamp.lane) : (getRoleKey((selectedChamp as any).playLanes?.[0]) || "TOP"))
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

  // Cargar iconos de habilidades de DDragon
  useEffect(() => {
    if (!selectedChamp) {
      queueMicrotask(() => setSpellImages({}));
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
    
    if (selectedLane !== "ALL" && metaCache && metaCache[metaKey]) {
      const laneList = metaCache[metaKey] || [];
      const list: Champion[] = [];
      
      laneList.forEach((metaChamp: any) => {
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

    let list = [...champions];

    if (selectedLane !== "ALL") {
      list = list.filter(c => {
        const dbLane = c.lane?.toUpperCase() || "";
        const target = getRoleKey(selectedLane);
        return dbLane === target;
      });
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

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

  const renderSortIndicator = (field: 'winrate' | 'pickrate' | 'tier' | 'name') => {
    if (sortBy !== field) return null;
    return (
      <span className="ml-1 text-purple-accent select-none inline-block align-middle text-[10px]">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

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
      {selectedChamp ? (
        <ChampionDetail
          selectedChamp={selectedChamp}
          champDetails={champDetails}
          detailsLoading={detailsLoading}
          activeBuildIdx={activeBuildIdx}
          setActiveBuildIdx={setActiveBuildIdx}
          selectedLane={selectedLane}
          initialChampionId={initialChampionId}
          setSelectedChamp={setSelectedChamp}
          tacticalLoading={tacticalLoading}
          tacticalData={tacticalData}
          spellImages={spellImages}
          gameVersion={gameVersion}
        />
      ) : (
        <ChampionList
          processedChampions={processedChampions}
          selectedLane={selectedLane}
          setSelectedLane={setSelectedLane}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          toggleSort={toggleSort}
          renderSortIndicator={renderSortIndicator}
          lastUpdated={lastUpdated}
          timeAgoText={timeAgoText}
        />
      )}
    </div>
  );
};

export default ChampionsStats;
