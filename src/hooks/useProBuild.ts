// src/hooks/useProBuild.ts
import { useState, useEffect, useRef } from 'react';
import { exportProBuildToClient } from '../lib/services/proBuildExporter';

export interface ProBuildRunes {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
}

export interface ProBuildData {
  id?: string;
  title?: string;
  championName: string;
  role: string;
  patch: string;
  sampleSize: number;
  winRate: number;
  coreItems: number[];
  boots: number;
  starterItems: number[];
  summoners: number[];
  runes: ProBuildRunes;
  source?: 'otp_matchup' | 'otp_general' | 'general_pro';
  otpRank?: number;
  otpName?: string;
}

export interface UseProBuildResult {
  loading: boolean;
  data: ProBuildData | null;
  builds: ProBuildData[];
  activeBuildIndex: number;
  setActiveBuildIndex: (index: number) => void;
  error: string | null;
  insufficientData: boolean;
  archetype: string;
  cachedAt: number | null;
}

export function useProBuild(
  championName: string | null | undefined,
  opponentName: string | null | undefined,
  role: string | null | undefined,
  patch: string = '16.15'
): UseProBuildResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [builds, setBuilds] = useState<ProBuildData[]>([]);
  const [activeBuildIndex, setActiveBuildIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [insufficientData, setInsufficientData] = useState<boolean>(false);
  const [archetype, setArchetype] = useState<string>('');
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exportedKeyRef = useRef<string>('');

  const activeBuild = builds[activeBuildIndex] || builds[0] || null;

  // Auto-export al cliente LCU cuando cambia la build activa
  useEffect(() => {
    if (activeBuild && activeBuild.championName) {
      const buildKey = `${activeBuild.championName}_${activeBuild.role}_${activeBuild.patch}_${activeBuild.coreItems.join('-')}_${activeBuild.runes.selections[0]}`;
      if (exportedKeyRef.current !== buildKey) {
        exportedKeyRef.current = buildKey;
        exportProBuildToClient(activeBuild);
      }
    }
  }, [activeBuild]);

  const clearTimers = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimers();

    if (!championName || !role) {
      return;
    }

    const queryParams = new URLSearchParams({
      champion: championName,
      opponent: opponentName || '',
      role: role,
      patch: patch
    }).toString();

    const fetchInitial = async () => {
      setLoading(true);
      setError(null);
      setInsufficientData(false);
      setBuilds([]);
      setActiveBuildIndex(0);

      try {
        const res = await fetch(`/api/pro-build?${queryParams}`);
        if (!res.ok) {
          throw new Error(`Error de servidor (${res.status})`);
        }
        const json = await res.json();
        setArchetype(json.archetype || '');
        setCachedAt(json.cachedAt || null);

        if (json.status === 'ready') {
          const list: ProBuildData[] = json.builds && json.builds.length > 0
            ? json.builds
            : json.data ? [json.data] : [];

          if (list.length > 0) {
            setBuilds(list);
            setLoading(false);
          } else {
            setInsufficientData(true);
            setLoading(false);
          }
        } else if (json.status === 'insufficient_data') {
          setInsufficientData(true);
          setLoading(false);
        } else if (json.status === 'error') {
          setError(json.error || 'No se pudo obtener información de op.gg');
          setLoading(false);
        } else {
          startPolling(queryParams);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`No se pudo obtener información de op.gg: ${msg}`);
        setLoading(false);
      }
    };

    const startPolling = (params: string) => {
      timeoutTimerRef.current = setTimeout(() => {
        clearTimers();
        setLoading(false);
        setError('Tiempo de espera agotado al consultar op.gg');
      }, 45000);

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/pro-build/status?${params}`);
          if (!res.ok) return;

          const json = await res.json();
          setArchetype(json.archetype || '');

          if (json.status === 'ready') {
            const list: ProBuildData[] = json.builds && json.builds.length > 0
              ? json.builds
              : json.data ? [json.data] : [];

            if (list.length > 0) {
              setBuilds(list);
              setCachedAt(json.cachedAt || null);
              setLoading(false);
              clearTimers();
            }
          } else if (json.status === 'insufficient_data') {
            setInsufficientData(true);
            setLoading(false);
            clearTimers();
          } else if (json.status === 'error') {
            setError(json.error || 'Error al procesar build de op.gg');
            setLoading(false);
            clearTimers();
          }
        } catch {
          // Ignorar errores transitorios de polling
        }
      }, 2000);
    };

    fetchInitial();

    return () => {
      clearTimers();
    };
  }, [championName, opponentName, role, patch]);

  return {
    loading,
    data: activeBuild,
    builds,
    activeBuildIndex,
    setActiveBuildIndex,
    error,
    insufficientData,
    archetype,
    cachedAt
  };
}
