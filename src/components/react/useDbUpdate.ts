import { useState, useEffect, useCallback } from 'react';

export const useDbUpdate = () => {
  const [checking, setChecking] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [localPatch, setLocalPatch] = useState('-');
  const [remotePatch, setRemotePatch] = useState('-');
  const [localVersion, setLocalVersion] = useState(0);
  const [remoteVersion, setRemoteVersion] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [remoteChecksum, setRemoteChecksum] = useState('');
  const [remoteManifest, setRemoteManifest] = useState<any>(null);

  const checkForUpdate = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/db/manifest');
      if (!res.ok) {
        throw new Error('Fallo al obtener el manifest de base de datos');
      }
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setNeedsUpdate(data.needsUpdate);
      setLocalPatch(data.local?.patch || '-');
      setLocalVersion(data.local?.version || 0);
      setRemotePatch(data.remote?.patch || '-');
      setRemoteVersion(data.remote?.version || 0);
      setDownloadUrl(data.remote?.downloadUrl || '');
      setRemoteChecksum(data.remote?.checksum || '');
      setRemoteManifest(data.remote || null);
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setChecking(false);
    }
  }, []);

  const startUpdate = useCallback(async () => {
    if (!downloadUrl || !remoteChecksum) {
      setError('No hay actualización disponible o faltan datos de descarga');
      return;
    }

    setDownloading(true);
    setProgress(0);
    setError(null);
    setMessage('Iniciando descarga...');

    try {
      const response = await fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          downloadUrl,
          expectedChecksum: remoteChecksum,
          manifest: remoteManifest
        })
      });

      if (!response.ok) {
        throw new Error('Error al iniciar la actualización en el servidor');
      }

      if (!response.body) {
        throw new Error('La respuesta del servidor no tiene cuerpo de datos');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Mantener la última línea incompleta en el buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            try {
              const data = JSON.parse(dataStr);
              if (data.status === 'downloading' || data.status === 'starting' || data.status === 'verifying' || data.status === 'installing') {
                if (data.progress !== undefined) setProgress(data.progress);
                setMessage(data.message || '');
              } else if (data.message) {
                setMessage(data.message);
              }
              
              if (data.status === 'error') {
                throw new Error(data.message || 'Error en el servidor durante la actualización');
              }
              
              if (data.status === 'done') {
                setMessage(data.message || '¡Base de datos actualizada!');
              }
            } catch (jsonErr) {
              console.error('Error parseando SSE data:', jsonErr);
            }
          }
        }
      }

      // Si terminamos de leer sin errores, emitir evento custom y actualizar estados
      setNeedsUpdate(false);
      setLocalVersion(remoteVersion);
      setLocalPatch(remotePatch);

      window.dispatchEvent(new CustomEvent('hexdraft-db-updated', {
        detail: { version: remoteVersion, patch: remotePatch }
      }));

    } catch (e: any) {
      setError(e.message || 'Error de conexión durante la descarga');
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, remoteChecksum, remoteManifest, remoteVersion, remotePatch]);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return {
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
    startUpdate,
    checkForUpdate
  };
};
