import { useState, useCallback } from 'react';
import type { Tab, DetachedWindow } from '@/app/types';

// ===========================
// useFloatingWindows Hook
// ===========================
// Manages the set of floating-window frames (position/size). The actual Tab
// objects stay in the parent `tabs` array and are only marked `detached: true`
// so React keeps their content mounted (preserving state on detach).

export interface UseFloatingWindowsReturn {
  detachedWindows: DetachedWindow[];
  addWindow: (tab: Tab, x: number, y: number) => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<Pick<DetachedWindow, 'x' | 'y' | 'width' | 'height'>>) => void;
}

// Default floating-window sizes per page kind.
// Knowledge / Library / file / explore are information-dense (lists +
// preview columns), so they need more room; Chat / translate are lighter.
const DEFAULT_SIZE_BY_MENU: Record<string, { width: number; height: number }> = {
  knowledge:  { width: 960, height: 680 },
  library:    { width: 920, height: 640 },
  file:       { width: 880, height: 600 },
  explore:    { width: 880, height: 600 },
  miniapp:    { width: 880, height: 620 },
  agent:      { width: 900, height: 640 },
  models:     { width: 820, height: 620 },
  extensions: { width: 820, height: 600 },
  note:       { width: 800, height: 600 },
  painting:   { width: 800, height: 560 },
  code:       { width: 780, height: 560 },
  chat:       { width: 720, height: 560 },
  translate:  { width: 720, height: 520 },
};
const FALLBACK_SIZE = { width: 640, height: 480 };

function resolveInitialSize(tab: Tab): { width: number; height: number } {
  if (tab.miniAppId) return DEFAULT_SIZE_BY_MENU.miniapp;
  if (tab.menuItemId && DEFAULT_SIZE_BY_MENU[tab.menuItemId]) {
    return DEFAULT_SIZE_BY_MENU[tab.menuItemId];
  }
  return FALLBACK_SIZE;
}

export function useFloatingWindows(): UseFloatingWindowsReturn {
  const [detachedWindows, setDetachedWindows] = useState<DetachedWindow[]>([]);

  const addWindow = useCallback((tab: Tab, x: number, y: number) => {
    if (!tab || !tab.closeable) return;
    const { width, height } = resolveInitialSize(tab);
    // Clamp initial position so the window doesn't open off-screen
    const maxX = Math.max(0, window.innerWidth - width - 24);
    const maxY = Math.max(0, window.innerHeight - height - 24);
    const clampedX = Math.min(Math.max(24, x), maxX);
    const clampedY = Math.min(Math.max(24, y), maxY);
    setDetachedWindows(prev => [
      ...prev,
      { id: `w-${tab.id}`, tabId: tab.id, x: clampedX, y: clampedY, width, height },
    ]);
  }, []);

  const removeWindow = useCallback((id: string) => {
    setDetachedWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<Pick<DetachedWindow, 'x' | 'y' | 'width' | 'height'>>) => {
    setDetachedWindows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  return {
    detachedWindows,
    addWindow,
    removeWindow,
    updateWindow,
  };
}
