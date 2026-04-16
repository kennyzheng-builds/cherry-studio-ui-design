import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import {
  Plus, X, ChevronDown,
} from 'lucide-react';
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

// === Layout budget constants (tuned for h-11 tab bar) ===
const PINNED_WIDTH = 96;       // avg pinned pill width (icon + ~3 chars)
const UNPINNED_WIDTH = 140;    // avg unpinned tab width (icon + label + × + gap)
const SEPARATOR_WIDTH = 10;
const PLUS_BUTTON_WIDTH = 32;
const OVERFLOW_BUTTON_WIDTH = 44;
const PINNED_CONTAINER_PADDING = 8;

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

  // Measure available width for responsive budgeting
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // === Responsive visibility budget ===
  // How many unpinned tabs fit given the current container width?
  // - Pinned always stay visible (they're the user's workbench)
  // - Active unpinned is guaranteed visible (swapped in from overflow if needed)
  const { visibleUnpinned, overflowTabs } = useMemo(() => {
    if (containerWidth === 0 || unpinnedTabs.length === 0) {
      return { visibleUnpinned: unpinnedTabs, overflowTabs: [] as Tab[] };
    }

    const pinnedWidth =
      pinnedTabs.length > 0
        ? pinnedTabs.length * PINNED_WIDTH + PINNED_CONTAINER_PADDING
        : 0;
    const separatorWidth = pinnedTabs.length > 0 ? SEPARATOR_WIDTH : 0;

    // Assume overflow button may appear — reserve its width up front so we
    // don't need a second pass when the threshold is crossed.
    const reservedRight = PLUS_BUTTON_WIDTH + OVERFLOW_BUTTON_WIDTH;

    const budget = containerWidth - pinnedWidth - separatorWidth - reservedRight;
    const maxVisible = Math.max(1, Math.floor(budget / UNPINNED_WIDTH));

    if (unpinnedTabs.length <= maxVisible) {
      return { visibleUnpinned: unpinnedTabs, overflowTabs: [] as Tab[] };
    }

    // Keep the rightmost `maxVisible` tabs (newest are on the right).
    const tail = unpinnedTabs.slice(-maxVisible);
    const activeInTail = tail.some(t => t.id === activeTabId);

    if (activeInTail) {
      return {
        visibleUnpinned: tail,
        overflowTabs: unpinnedTabs.slice(0, -maxVisible),
      };
    }

    // Active is in the overflow zone → swap it into the leftmost visible slot
    // so the user can always see what they're currently looking at.
    const active = unpinnedTabs.find(t => t.id === activeTabId);
    if (!active) {
      return {
        visibleUnpinned: tail,
        overflowTabs: unpinnedTabs.slice(0, -maxVisible),
      };
    }
    const adjusted = [active, ...tail.slice(1)];
    const adjustedIds = new Set(adjusted.map(t => t.id));
    return {
      visibleUnpinned: adjusted,
      overflowTabs: unpinnedTabs.filter(t => !adjustedIds.has(t.id)),
    };
  }, [containerWidth, pinnedTabs, unpinnedTabs, activeTabId]);

  return (
    <div className="h-11 bg-sidebar flex items-center select-none flex-shrink-0">
      {/* Traffic lights */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d4a528]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#24a732]" />
      </div>

      {/* Tabs area */}
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

        {/* Visible unpinned tabs */}
        {visibleUnpinned.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.icon;
          return (
            <div
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              onContextMenu={(e) => onTabContext(e, tab.id)}
              onMouseDown={(e) => { if (tab.closeable) startTabDrag(e, tab.id); }}
              className={`group relative flex items-center gap-1.5 h-[30px] rounded-md cursor-pointer transition-all duration-150 min-w-[80px] max-w-[160px] flex-shrink
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
            </div>
          );
        })}

        {/* New-tab button — sits immediately to the right of the last visible tab */}
        <button
          onClick={onNewTab}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors flex-shrink-0 ml-0.5"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Overflow chevron — rendered outside the overflow-hidden tabs area so the dropdown isn't clipped */}
      {overflowTabs.length > 0 && (
        <div className="relative flex-shrink-0 pr-2">
          <Tooltip content={`${overflowTabs.length} 个折叠标签`} side="bottom">
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
