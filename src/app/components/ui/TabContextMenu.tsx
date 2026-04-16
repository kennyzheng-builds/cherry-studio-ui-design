import React, { useRef, useEffect, useMemo } from 'react';
import {
  Pin, PinOff, X,
  ArrowRightFromLine, SquareX, ExternalLink,
} from 'lucide-react';
import type { ContextMenuState, Tab } from '@/app/types';

// ===========================
// Tab Context Menu
// ===========================
// Naming follows standard browser/IDE conventions (Chrome / Edge / VS Code):
//   - 固定标签页 / 取消固定  (Pin / Unpin)
//   - 关闭标签页             (Close Tab)
//   - 关闭其他标签页         (Close Other Tabs)
//   - 关闭右侧标签页         (Close Tabs to the Right)
//   - 移至新窗口             (Move to New Window)
// Pinned tabs and protected tabs (home / miniApp) are excluded from batch closes.

export function TabContextMenu({
  state,
  tab,
  tabs,
  onPin,
  onClose,
  onCloseOthers,
  onCloseRight,
  onDetach,
  onDismiss,
}: {
  state: ContextMenuState;
  tab: Tab | undefined;
  tabs: Tab[];
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseRight: (id: string) => void;
  onDetach: (id: string, x: number, y: number) => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state.visible, onDismiss]);

  // Count closeable tabs other than the current one, and to the right of it
  const { hasOthers, hasRight } = useMemo(() => {
    if (!tab) return { hasOthers: false, hasRight: false };
    const idx = tabs.findIndex(t => t.id === tab.id);
    const isClosableSibling = (t: Tab) =>
      t.id !== tab.id && t.closeable && !t.pinned && t.id !== 'home' && !t.miniAppId;
    const others = tabs.some(isClosableSibling);
    const right = idx >= 0 && tabs.slice(idx + 1).some(isClosableSibling);
    return { hasOthers: others, hasRight: right };
  }, [tab, tabs]);

  if (!state.visible || !tab) return null;

  const isHome = tab.id === 'home';

  return (
    <div
      ref={ref}
      className="fixed z-[300] bg-popover border border-border rounded-lg shadow-xl p-0.5 min-w-[160px] text-[11px]"
      style={{ left: state.x, top: state.y }}
    >
      {/* Pin / Unpin */}
      {!isHome && (
        <button
          className="w-full flex items-center gap-1.5 px-2 py-[5px] text-[11px] text-popover-foreground hover:bg-accent rounded-md transition-colors text-left"
          onClick={() => { onPin(state.tabId); onDismiss(); }}
        >
          {tab.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          {tab.pinned ? '取消固定' : '固定标签页'}
        </button>
      )}

      {/* Move to new window */}
      {tab.closeable && !isHome && (
        <button
          className="w-full flex items-center gap-1.5 px-2 py-[5px] text-[11px] text-popover-foreground hover:bg-accent rounded-md transition-colors text-left"
          onClick={() => { onDetach(state.tabId, state.x, state.y); onDismiss(); }}
        >
          <ExternalLink size={11} />
          移至新窗口
        </button>
      )}

      {/* Separator before close actions */}
      {(!isHome && (tab.closeable || hasOthers || hasRight)) && (
        <div className="my-0.5 mx-1 border-t border-border/50" />
      )}

      {/* Close tab */}
      {tab.closeable && !isHome && (
        <button
          className="w-full flex items-center gap-1.5 px-2 py-[5px] text-[11px] text-popover-foreground hover:bg-accent rounded-md transition-colors text-left"
          onClick={() => { onClose(state.tabId); onDismiss(); }}
        >
          <X size={11} />
          关闭标签页
        </button>
      )}

      {/* Close tabs to the right */}
      {hasRight && (
        <button
          className="w-full flex items-center gap-1.5 px-2 py-[5px] text-[11px] text-popover-foreground hover:bg-accent rounded-md transition-colors text-left"
          onClick={() => { onCloseRight(state.tabId); onDismiss(); }}
        >
          <ArrowRightFromLine size={11} />
          关闭右侧标签页
        </button>
      )}

      {/* Close other tabs */}
      {hasOthers && (
        <button
          className="w-full flex items-center gap-1.5 px-2 py-[5px] text-[11px] text-popover-foreground hover:bg-accent rounded-md transition-colors text-left"
          onClick={() => { onCloseOthers(state.tabId); onDismiss(); }}
        >
          <SquareX size={11} />
          关闭其他标签页
        </button>
      )}

      {isHome && (
        <div className="px-2.5 py-[5px] text-[11px] text-muted-foreground">首页（固定）</div>
      )}
    </div>
  );
}
