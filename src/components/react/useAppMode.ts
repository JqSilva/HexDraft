import { useState, useEffect } from 'react';

interface AppModeState {
  isAdmin: boolean;
  mode: 'admin' | 'user' | null;
  loaded: boolean;
}

let cachedMode: AppModeState | null = null;

export const useAppMode = () => {
  const [state, setState] = useState<AppModeState>(
    cachedMode || { isAdmin: false, mode: null, loaded: false }
  );

  useEffect(() => {
    if (state.loaded) return;

    if (cachedMode) {
      queueMicrotask(() => setState(cachedMode!));
      return;
    }

    let active = true;
    const fetchMode = async () => {
      try {
        const res = await fetch('/api/config/mode');
        if (!res.ok) throw new Error();
        const data = await res.json();
        const newState: AppModeState = {
          isAdmin: data.mode === 'admin',
          mode: data.mode,
          loaded: true
        };
        cachedMode = newState;
        if (active) setState(newState);
      } catch (e) {
        const newState: AppModeState = {
          isAdmin: false,
          mode: 'user',
          loaded: true
        };
        cachedMode = newState;
        if (active) setState(newState);
      }
    };

    fetchMode();
    return () => {
      active = false;
    };
  }, [state.loaded]);

  return state;
};
