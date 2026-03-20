'use client';

import { useState, useEffect } from 'react';

const ZEN_MODE_KEY = 'gradeos-zen-mode';

export function useZenMode() {
  const [isZenMode, setIsZenMode] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(ZEN_MODE_KEY);
    if (stored === 'true') {
      setIsZenMode(true);
    }
  }, []);

  useEffect(() => {
    // Update body class and persist
    const root = document.getElementById('dashboard-root');
    if (root) {
      if (isZenMode) {
        root.classList.add('zen-mode');
      } else {
        root.classList.remove('zen-mode');
      }
    }
    localStorage.setItem(ZEN_MODE_KEY, String(isZenMode));
  }, [isZenMode]);

  const toggleZenMode = () => setIsZenMode(prev => !prev);

  return { isZenMode, toggleZenMode, setIsZenMode };
}
