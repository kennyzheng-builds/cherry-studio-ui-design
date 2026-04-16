import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import {
  Plus, X, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from '@/app/components/Tooltip';
import { TabOverflowMenu } from '@/app/components/ui/TabOverflowMenu';
import type { Tab } from '@/app/types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContext: (e: React.MouseEvent, tabId: string) => void;
  onNewTab: () => void;
  startTabDrag: (e: React.MouseEvent, tabId: string) => void;
}

// === Layout constants ===
// Minimum width that still leaves ~4-5 chars of title visible. Below this,
// rather than compressing further (Chrome-style), we route the least-recently-
// used tab into the overflow menu so visible titles stay readable.
const MIN_UNPINNED_WIDTH = 120;
const MAX_UNPINNED_WIDTH = 180;
const PINNED_WIDTH = 96;
const PINNED_CONTAINER_PADDING = 8;
const SEPARATOR_WIDTH = 10;
const PLUS_BUTTON_WIDTH = 32;
const OVERFLOW_BUTTON_WIDTH = 56;

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabContext,
  onNewTab,
  startTabDrag,
}: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const pinnedTabs = useMemo(
    () => tabs.filter(t => t.pinned && !t.sidebarDocked && !t.detached),
    [tabs],
  );
  const unpinnedTabs = useMemo(
    () => tabs.filter(t => !t.pinned && !t.sidebarDocked && !t.detached),
    [tabs],
  );

  // Measure available width for layout decisions
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // === Visible / overflow split ===
  // Goal: every visible tab is at least readable (>= MIN_UNPINNED_WIDTH).
  // INVARIANTS:
  //   1. Active tab is always visible.
  //   2. Visible tabs render in their original (creation) order — so a tab
  //      coming back from overflow lands in its familiar slot.
  //   3. Overflow holds non-active tabs whose lastActivatedAt is oldest.
  const { visibleUnpinned, overflowTabs, tabWidth } = useMemo(() => {
    if (containerWidth === 0 || unpinnedTabs.length === 0) {
      return { visibleUnpinned: unpinnedTabs, overflowTabs: [] as Tab[], tabWidth: MAX_UNPINNED_WIDTH };
    }

    const pinnedWidth = pinnedTabs.length > 0
      ? pinnedTabs.length * PINNED_WIDTH + PINNED_CONTAINER_PADDING
      : 0;
    const separatorWidth = pinnedTabs.length > 0 ? SEPARATOR_WIDTH : 0;
    const baseAvailable = Math.max(0, containerWidth - pinnedWidth - separatorWidth - PLUS_BUTTON_WIDTH);

    // First pass: do all unpinned tabs fit at min width WITHOUT the overflow
    // chevron taking up space?
    const maxNoOverflow = Math.max(1, Math.floor(baseAvailable / MIN_UNPINNED_WIDTH));
    if (unpinnedTabs.length <= maxNoOverflow) {
      const width = Math.min(MAX_UNPINNED_WIDTH, Math.floor(baseAvailable / unpinnedTabs.length));
      return { visibleUnpinned: unpinnedTabs, overflowTabs: [] as Tab[], tabWidth: width };
    }

    // Second pass: with overflow chevron eating its slice
    const availableWithOverflow = Math.max(0, baseAvailable - OVERFLOW_BUTTON_WIDTH);
    const maxVisible = Math.max(1, Math.floor(availableWithOverflow / MIN_UNPINNED_WIDTH));
    const width = Math.min(MAX_UNPINNED_WIDTH, Math.floor(availableWithOverflow / maxVisible));

    // Pick visible: active first (invariant 1), then most-recently-used non-active
    const visibleSet = new Set<string>();
    if (unpinnedTabs.some(t => t.id === activeTabId)) {
      visibleSet.add(activeTabId);
    }
    const sortedByMRU = [...unpinnedTabs]
      .filter(t => t.id !== activeTabId)
      .sort((a, b) => (b.lastActivatedAt ?? 0) - (a.lastActivatedAt ?? 0));
    for (const t of sortedByMRU) {
      if (visibleSet.size >= maxVisible) break;
      visibleSet.add(t.id);
    }

    // Render in original order (invariant 2)
    const visibleUnpinned = unpinnedTabs.filter(t => visibleSet.has(t.id));
    const overflowTabs = unpinnedTabs.filter(t => !visibleSet.has(t.id));
    return { visibleUnpinned, overflowTabs, tabWidth: width };
  }, [containerWidth, pinnedTabs, unpinnedTabs, activeTabId]);

  return (
    <div className="h-11 bg-sidebar flex items-center select-none flex-shrink-0 pl-2">
      {/* Tabs area — traffic lights live in the sidebar column now so the tab
          bar only spans the content area (right of the sidebar). */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center gap-0.5 overflow-hidden min-w-0 px-1"
      >
        {/* Pinned tabs — grouped in a shared rounded container, icon + text */}
        {pinnedTabs.length > 0 && (
          <div className="flex items-center bg-sidebar-accent/50 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            {pinnedTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const Icon = tab.icon;
              return (
                <Tooltip key={tab.id} content={tab.title} side="bottom">
                  <div
                    onClick={() => onTabClick(tab.id)}
                    onContextMenu={(e) => onTabContext(e, tab.id)}
                    onMouseDown={(e) => { if (tab.closeable) startTabDrag(e, tab.id); }}
                    className={`flex items-center gap-1.5 h-[26px] px-2 min-w-[60px] max-w-[96px] rounded-md cursor-pointer transition-all duration-150
                      ${isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}
                  >
                    {tab.miniAppId ? (
                      tab.miniAppLogoUrl
                        ? <img src={tab.miniAppLogoUrl} alt="" className="w-3.5 h-3.5 rounded-[3px] object-cover flex-shrink-0" />
                        : <div className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-white text-[6px] flex-shrink-0" style={{ background: tab.miniAppColor }}>{tab.miniAppInitial}</div>
                    ) : <Icon size={13} strokeWidth={1.6} className="flex-shrink-0" />}
                    <span className="text-[11px] truncate">{tab.title}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Separator between pinned group and unpinned */}
        {pinnedTabs.length > 0 && visibleUnpinned.length > 0 && (
          <div className="w-px h-4 bg-border/50 mx-1 flex-shrink-0" />
        )}

        {/* Visible unpinned tabs — animated in/out as they swap with overflow */}
        <AnimatePresence initial={false}>
          {visibleUnpinned.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.icon;
            return (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: tabWidth }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{ width: tabWidth }}
                onClick={() => onTabClick(tab.id)}
                onContextMenu={(e) => onTabContext(e, tab.id)}
                onMouseDown={(e) => { if (tab.closeable) startTabDrag(e, tab.id); }}
                className={`group relative flex items-center gap-1.5 h-[30px] rounded-md cursor-pointer overflow-hidden flex-shrink-0
                  ${tab.closeable ? 'pl-2 pr-1' : 'px-2'}
                  ${isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  }`}
              >
                {tab.miniAppId ? (
                  tab.miniAppLogoUrl
                    ? <img src={tab.miniAppLogoUrl} alt="" className="w-3.5 h-3.5 rounded-[3px] object-cover flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-white text-[6px] flex-shrink-0" style={{ background: tab.miniAppColor }}>{tab.miniAppInitial}</div>
                ) : <Icon size={13} strokeWidth={1.6} className="flex-shrink-0" />}
                <span className="text-[11px] truncate">{tab.title}</span>
                {tab.closeable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                    className={`w-[18px] h-[18px] flex items-center justify-center rounded-sm hover:bg-foreground/10 transition-colors flex-shrink-0 ml-auto
                      ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <X size={10} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* New-tab button — sits immediately to the right of the last visible tab */}
        <button
          onClick={onNewTab}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors flex-shrink-0 ml-0.5"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Overflow chevron — only renders when there are tabs to show. Lives
          outside the overflow-hidden tabs area so its dropdown isn't clipped. */}
      {overflowTabs.length > 0 && (
        <div className="relative flex-shrink-0 pr-2">
          <Tooltip content={`${overflowTabs.length} 个其他标签`} side="bottom">
            <button
              onClick={() => setOverflowOpen(v => !v)}
              className={`h-7 px-1.5 flex items-center gap-0.5 rounded-md transition-colors
                ${overflowOpen
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                }`}
            >
              <ChevronDown size={13} strokeWidth={1.8} />
              <span className="text-[10px] tabular-nums">{overflowTabs.length}</span>
            </button>
          </Tooltip>
          <TabOverflowMenu
            open={overflowOpen}
            tabs={overflowTabs}
            activeTabId={activeTabId}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
            onDismiss={() => setOverflowOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
