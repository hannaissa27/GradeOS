'use client';

import { CanvasProvider } from '@/lib/canvas-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CanvasProvider>{children}</CanvasProvider>;
}
