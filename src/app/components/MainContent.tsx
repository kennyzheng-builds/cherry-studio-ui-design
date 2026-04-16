import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PictureInPicture2, X } from 'lucide-react';
import type { Tab, DetachedWindow } from '@/app/types';
import { TabPageRenderer } from './TabPageRenderer';
import { FloatingWindowContext } from '@/app/context/FloatingWindowContext';

interface MainContentProps {
  tabs: Tab[];
  activeTabId: string;
  detachedWindows: DetachedWindow[];
  onReattachWindow: (win: DetachedWindow) => void;
  onCloseFloatingWindow: (win: DetachedWindow) => void;
  onUpdateWindow: (id: string, updates: Partial<Pick<DetachedWindow, 'x' | 'y' | 'width' | 'height'>>) => void;
}

/**
 * Keep-Alive MainContent with in-place detach.
 *
 * Tabs stay in the `tabs` array even when popped out — `tab.detached` flips
 * styling from "inline tab pane" to "fixed floating window" while keeping the
 * same React node (same <div>, same <TabPageRenderer> instance). This is what
 * makes chat messages / scroll position / input text survive detach.
 *
 * The child order inside each tab's <div> is always [chrome?, content, handles?]
 * so the content slot stays at a stable position regardless of detached state,
 * and React does not remount TabPageRenderer.
 */
export function MainContent({
  tabs, activeTabId, detachedWindows,
  onReattachWindow, onCloseFloatingWindow, onUpdateWindow,
}: MainContentProps) {
  const [mountedTabIds, setMountedTabIds] = useState<Set<string>>(() => new Set([activeTabId]));

  // Mount active tab + all detached tabs lazily (but keep them once mounted).
  useEffect(() => {
    if (!activeTabId) return;
    setMountedTabIds(prev => {
      if (prev.has(activeTabId)) return prev;
      const next = new Set(prev);
      next.add(activeTabId);
      return next;
    });
  }, [activeTabId]);

  useEffect(() => {
    if (detachedWindows.length === 0) return;
    setMountedTabIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const w of detachedWindows) {
        if (!next.has(w.tabId)) { next.add(w.tabId); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [detachedWindows]);

  // Clean up mounted ids when tabs are removed
  const tabIdSet = useMemo(() => new Set(tabs.map(t => t.id)), [tabs]);
  useEffect(() => {
    setMountedTabIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (tabIdSet.has(id)) next.add(id); });
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [tabIdSet]);

  const winByTabId = useMemo(() => {
    const m = new Map<string, DetachedWindow>();
    detachedWindows.forEach(w => m.set(w.tabId, w));
    return m;
  }, [detachedWindows]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {tabs.filter(t => mountedTabIds.has(t.id)).map(tab => {
        const win = winByTabId.get(tab.id);
        const isFloating = !!win;
        const isActive = tab.id === activeTabId;

        const style: React.CSSProperties = isFloating
          ? {
              position: 'fixed',
              left: win!.x,
              top: win!.y,
              width: win!.width,
              height: win!.height,
              zIndex: 100,
            }
          : { display: isActive ? 'flex' : 'none' };

        const className = isFloating
          ? 'flex flex-col bg-background border border-border rounded-xl shadow-2xl'
          : 'absolute inset-0 flex flex-col';

        return (
          <div key={tab.id} style={style} className={className}>
            {/* Window chrome — only when floating */}
            {isFloating ? (
              <FloatingTitleBar
                tab={tab}
                win={win!}
                onMove={(x, y) => onUpdateWindow(win!.id, { x, y })}
                onReattach={() => onReattachWindow(win!)}
                onClose={() => onCloseFloatingWindow(win!)}
              />
            ) : null}

            {/* Stable content slot — same position in child list across modes
                so React keeps TabPageRenderer mounted and its state survives
                the inline ↔ floating transition. */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <FloatingWindowContext.Provider value={isFloating}>
                <TabPageRenderer tab={tab} isActive={isFloating || isActive} />
              </FloatingWindowContext.Provider>
            </div>

            {/* Resize handles — only when floating */}
            {isFloating ? (
              <FloatingResizeHandles
                win={win!}
                onResize={(updates) => onUpdateWindow(win!.id, updates)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ===========================
// Floating Window Chrome
// ===========================

const MIN_W = 360;
const MIN_H = 280;

function FloatingTitleBar({
  tab, win, onMove, onReattach, onClose,
}: {
  tab: Tab;
  win: DetachedWindow;
  onMove: (x: number, y: number) => void;
  onReattach: () => void;
  onClose: () => void;
}) {
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = win.x;
    const originY = win.y;
    const onMouseMove = (ev: MouseEvent) => {
      onMove(originX + (ev.clientX - startX), originY + (ev.clientY - startY));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const Icon = tab.icon;
  return (
    <div
      className="h-9 bg-accent/50 border-b border-border flex items-center px-3 gap-2 cursor-move select-none flex-shrink-0 rounded-t-xl"
      onMouseDown={onMouseDown}
    >
      {tab.miniAppId ? (
        tab.miniAppLogoUrl
          ? <img src={tab.miniAppLogoUrl} alt="" className="w-3.5 h-3.5 rounded-[3px] object-cover" />
          : <div className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-white text-[6px]" style={{ background: tab.miniAppColor }}>{tab.miniAppInitial}</div>
      ) : <Icon size={13} className="text-muted-foreground" />}
      <span className="text-xs text-foreground flex-1 truncate">{tab.title}</span>
      <button
        onClick={onReattach}
        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="嵌回主窗口"
      >
        <PictureInPicture2 size={11} />
      </button>
      <button
        onClick={onClose}
        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="关闭窗口"
      >
        <X size={11} />
      </button>
    </div>
  );
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function FloatingResizeHandles({
  win, onResize,
}: {
  win: DetachedWindow;
  onResize: (updates: Partial<Pick<DetachedWindow, 'x' | 'y' | 'width' | 'height'>>) => void;
}) {
  const startResize = (e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { mx: e.clientX, my: e.clientY, w: win.width, h: win.height, x: win.x, y: win.y };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx;
      const dy = ev.clientY - start.my;
      let nextW = start.w;
      let nextH = start.h;
      let nextX = start.x;
      let nextY = start.y;

      if (dir.includes('e')) nextW = Math.max(MIN_W, start.w + dx);
      if (dir.includes('w')) {
        const clampedDx = Math.min(dx, start.w - MIN_W);
        nextW = start.w - clampedDx;
        nextX = start.x + clampedDx;
      }
      if (dir.includes('s')) nextH = Math.max(MIN_H, start.h + dy);
      if (dir.includes('n')) {
        const clampedDy = Math.min(dy, start.h - MIN_H);
        nextH = start.h - clampedDy;
        nextY = start.y + clampedDy;
      }
      onResize({ x: nextX, y: nextY, width: nextW, height: nextH });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {/* Edges */}
      <div onMouseDown={e => startResize(e, 'n')} className="absolute top-0 left-3 right-3 h-1 cursor-n-resize z-10" />
      <div onMouseDown={e => startResize(e, 's')} className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize z-10" />
      <div onMouseDown={e => startResize(e, 'e')} className="absolute top-3 bottom-3 right-0 w-1 cursor-e-resize z-10" />
      <div onMouseDown={e => startResize(e, 'w')} className="absolute top-3 bottom-3 left-0 w-1 cursor-w-resize z-10" />
      {/* Corners (larger hit target, on top of edges) */}
      <div onMouseDown={e => startResize(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-20" />
      <div onMouseDown={e => startResize(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-20" />
      <div onMouseDown={e => startResize(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-20" />
      <div onMouseDown={e => startResize(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-20" />
    </>
  );
}
