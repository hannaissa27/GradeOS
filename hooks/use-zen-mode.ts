'use client';

import { useState, useEffect } from 'react';

const ZEN_MODE_KEY = 'gradeos-zen-mode';

export function useZenMode() {
  const [isZenMode, setIsZenMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setIsZenMode(localStorage.getItem(ZEN_MODE_KEY) === 'true');
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(ZEN_MODE_KEY, String(isZenMode)); } catch {}
  }, [isZenMode, loaded]);

  const toggleZenMode = () => setIsZenMode(prev => !prev);

  return { isZenMode, toggleZenMode, setIsZenMode };
}
