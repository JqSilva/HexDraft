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
  const [data, setData] = useState<ProBuildData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insufficientData, setInsufficientData] = useState<boolean>(false);
  const [archetype, setArchetype] = useState<string>('');
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exportedKeyRef = useRef<string>('');

  useEffect(() => {
    if (data && data.championName) {
      const buildKey = `${data.championName}_${data.role}_${data.patch}_${data.coreItems.join('-')}`;
      if (exportedKeyRef.current !== buildKey) {
        exportedKeyRef.current = buildKey;
        exportProBuildToClient(data);
      }
    }
  }, [data]);

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
      setData(null);

      try {
        const res = await fetch(`/api/pro-build?${queryParams}`);
        if (!res.ok) {
          throw new Error(`Error de servidor (${res.status})`);
        }
        const json = await res.json();
        setArchetype(json.archetype || '');
        setCachedAt(json.cachedAt || null);

        if (json.status === 'ready' && json.data) {
          setData(json.data);
          setLoading(false);
        } else if (json.status === 'insufficient_data') {
          setInsufficientData(true);
          setLoading(false);
        } else if (json.status === 'error') {
          setError(json.error || 'No se pudo obtener información de op.gg');
          setLoading(false);
        } else {
          // Estado 'loading' -> iniciar polling (máximo 45 segundos)
          startPolling(queryParams);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`No se pudo obtener información de op.gg: ${msg}`);
        setLoading(false);
      }
    };

    const startPolling = (params: string) => {
      // Temporizador de expiración a los 45s
      timeoutTimerRef.current = setTimeout(() => {
        clearTimers();
        setLoading(false);
        setError('Tiempo de espera agotado al consultar op.gg');
      }, 45000);

      // Polling cada 2000ms
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/pro-build/status?${params}`);
          if (!res.ok) return;

          const json = await res.json();
          setArchetype(json.archetype || '');

          if (json.status === 'ready' && json.data) {
            clearTimers();
            setData(json.data);
            setCachedAt(json.cachedAt || null);
            setLoading(false);
          } else if (json.status === 'insufficient_data') {
            clearTimers();
            setInsufficientData(true);
            setLoading(false);
          } else if (json.status === 'error') {
            clearTimers();
            setError(json.error || 'No se pudo obtener información de op.gg');
            setLoading(false);
          }
        } catch {
          // Ignorar errores transitorios de red durante polling
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
    data,
    error,
    insufficientData,
    archetype,
    cachedAt
  };
}
