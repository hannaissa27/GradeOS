'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'gradeos-theme';
const EVENT = 'gradeos-theme-change';

function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

/**
 * Theme state shared by every component that calls this hook.
 * The initial class is set by an inline script in app/layout.tsx (before paint);
 * this hook just mirrors it and keeps all instances in sync when one toggles.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
    const onChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const toggle = () => applyTheme(readTheme() === 'dark' ? 'light' : 'dark');

  return { theme, toggle, mounted };
}
