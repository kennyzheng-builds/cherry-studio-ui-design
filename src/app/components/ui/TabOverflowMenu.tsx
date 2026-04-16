import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Tab } from '@/app/types';

interface TabOverflowMenuProps {
  open: boolean;
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onDismiss: () => void;
}

/**
 * Bird's-eye view of the tabs that didn't fit in the visible strip.
 * Tabs are sorted MRU (most recently activated first) so the user's
 * "where did my tab go" instinct is satisfied — recently-touched tabs
 * sit at the top of the list.
 */
export function TabOverflowMenu({
  open,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onDismiss,
}: TabOverflowMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // Reset search when dropdown closes; auto-focus when it opens
  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  // Dismiss on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    // Defer listener so the triggering click doesn't immediately dismiss it
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onDismiss]);

  const sortedFiltered = useMemo(() => {
    const sorted = [...tabs].sort(
      (a, b) => (b.lastActivatedAt ?? 0) - (a.lastActivatedAt ?? 0),
    );
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(t => t.title.toLowerCase().includes(q));
  }, [tabs, query]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-1 z-50 w-[280px] bg-popover border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Search */}
      <div className="px-2 pt-2 pb-1.5">
        <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-accent/15 border border-border/20">
          <Search size={11} className="text-muted-foreground/40 flex-shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索标签..."
            className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground/40 hover:text-muted-foreground/70">
              <X size={9} />
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">
        {sortedFiltered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[10.5px] text-muted-foreground/50">
            {query ? '未找到匹配的标签' : '没有其他标签'}
          </div>
        ) : (
          sortedFiltered.map(tab => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                onClick={() => { onTabClick(tab.id); onDismiss(); }}
                className={`group flex items-center gap-2.5 mx-1 px-2 h-10 rounded-md cursor-pointer transition-colors
                  ${isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-foreground hover:bg-accent/60'
                  }`}
              >
                <div className="w-6 h-6 rounded-md bg-accent/50 flex items-center justify-center flex-shrink-0">
                  {tab.miniAppId ? (
                    tab.miniAppLogoUrl
                      ? <img src={tab.miniAppLogoUrl} alt="" className="w-4 h-4 rounded-[3px] object-cover" />
                      : <div className="w-4 h-4 rounded-[3px] flex items-center justify-center text-white text-[7px]" style={{ background: tab.miniAppColor }}>{tab.miniAppInitial}</div>
                  ) : <Icon size={13} strokeWidth={1.6} className="text-foreground/70" />}
                </div>
                <span className="flex-1 text-[12px] truncate">{tab.title}</span>
                {tab.closeable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                    className={`w-5 h-5 flex items-center justify-center rounded hover:bg-foreground/10 transition-colors flex-shrink-0
                      ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
