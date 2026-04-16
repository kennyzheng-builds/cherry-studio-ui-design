import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MessageCircle } from 'lucide-react';
import {
  dialogAppIcons, dialogFilterTabs,
  newTabHistoryItems, newTabFileItems, dialogQuickActions,
} from '@/app/config/constants';

// ===========================
// New Tab Dialog
// ===========================
// Floating center modal opened from the "+" button or Cmd/Ctrl+T.
// Replaces the full-page NewTabPage with a Notion-inspired compact dialog:
// wider than a command palette (~640px), with an app launchpad, filter pills,
// and sectioned recent / files / quick actions.

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (menuItemId: string) => void;
  hiddenApps?: Set<string>;
  appOrder?: string[];
}

export function NewTabDialog({ open, onClose, onSelect, hiddenApps, appOrder }: Props) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('全部');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setActiveFilter('全部');
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Respect user's app ordering + hidden apps when available
  const orderedApps = appOrder && appOrder.length > 0
    ? appOrder.map(id => dialogAppIcons.find(a => a.id === id)).filter((a): a is typeof dialogAppIcons[0] => !!a)
    : dialogAppIcons;
  const visibleApps = hiddenApps
    ? orderedApps.filter(a => !hiddenApps.has(a.id))
    : orderedApps;

  const matchSearch = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const matchCategory = (cat: string) => activeFilter === '全部' || cat === activeFilter;

  const filteredRecent = newTabHistoryItems.filter(i => matchSearch(i.label + i.desc) && matchCategory(i.category));
  const filteredFiles = newTabFileItems.filter(i => matchSearch(i.label + i.desc) && matchCategory(i.category));
  const filteredActions = activeFilter === '全部' ? dialogQuickActions.filter(i => matchSearch(i.label)) : [];
  const hasResults = filteredRecent.length > 0 || filteredFiles.length > 0 || filteredActions.length > 0;

  const pick = (id: string) => { onSelect(id); onClose(); };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[7vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(640px,calc(100vw-48px))] max-h-[80vh] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0 border-b border-border/60">
          <Search size={16} className="text-muted-foreground/70 flex-shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话、文件，或开始新任务"
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
            >
              <X size={13} />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5 rounded bg-accent/60 flex-shrink-0">ESC</kbd>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/40 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* App launchpad */}
          {visibleApps.length > 0 && (
            <div className="mb-5">
              <div className="grid grid-cols-6 gap-y-3 gap-x-1">
                {visibleApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      onClick={() => pick(app.id)}
                      className="flex flex-col items-center gap-1.5 py-1 rounded-xl group hover:bg-accent/30 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform ${app.bg} ${app.color} group-hover:scale-[1.05] group-active:scale-[0.96]`}>
                        <Icon size={18} strokeWidth={1.7} />
                      </div>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-none">
                        {app.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {['全部', ...dialogFilterTabs].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-[3px] rounded-full text-[11px] whitespace-nowrap transition-colors ${
                  activeFilter === f
                    ? 'bg-foreground/[0.08] text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sections */}
          {hasResults ? (
            <div className="space-y-4">
              {/* Recent */}
              {filteredRecent.length > 0 && (
                <section>
                  <h2 className="text-[10px] text-muted-foreground/60 mb-1.5 px-1 tracking-wider uppercase">
                    最近 · {filteredRecent.length}
                  </h2>
                  <div className="space-y-0.5">
                    {filteredRecent.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`r-${i}`}
                          onClick={() => pick(item.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent/60 flex items-center justify-center flex-shrink-0">
                            <Icon size={13} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <span className="text-[12px] text-foreground truncate block">{item.label}</span>
                            <span className="text-[10.5px] text-muted-foreground/60 truncate block mt-[1px]">{item.desc}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 flex-shrink-0">
                            <MessageCircle size={9} />
                            <span>{item.count}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Files */}
              {filteredFiles.length > 0 && (
                <section>
                  <h2 className="text-[10px] text-muted-foreground/60 mb-1.5 px-1 tracking-wider uppercase">
                    文件 · {filteredFiles.length}
                  </h2>
                  <div className="space-y-0.5">
                    {filteredFiles.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`f-${i}`}
                          onClick={() => pick(item.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-accent/60 flex items-center justify-center flex-shrink-0">
                            <Icon size={13} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <span className="text-[12px] text-foreground truncate block">
                              {item.label} <span className="text-muted-foreground/70">· {item.desc}</span>
                            </span>
                            <span className="text-[10.5px] text-muted-foreground/60 truncate block mt-[1px]">{item.meta}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Quick Actions */}
              {filteredActions.length > 0 && (
                <section>
                  <h2 className="text-[10px] text-muted-foreground/60 mb-1.5 px-1 tracking-wider uppercase">
                    快捷操作
                  </h2>
                  <div className="space-y-0.5">
                    {filteredActions.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`a-${i}`}
                          onClick={() => pick(item.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-accent/60 flex items-center justify-center flex-shrink-0">
                            <Icon size={13} className="text-muted-foreground" />
                          </div>
                          <span className="text-[12px] text-foreground flex-1 text-left">{item.label}</span>
                          <kbd className="text-[10px] text-muted-foreground/50 bg-accent/60 px-1.5 py-0.5 rounded flex-shrink-0">{item.shortcut}</kbd>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <Search size={28} className="text-muted-foreground/20 mb-3" />
              <p className="text-[12px] text-foreground mb-1">未找到匹配结果</p>
              <p className="text-[10.5px] text-muted-foreground/60 text-center">
                尝试调整关键词或筛选条件
              </p>
              <button
                onClick={() => { setSearch(''); setActiveFilter('全部'); }}
                className="mt-3 px-3 py-1 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md transition-colors"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border/50 text-[10.5px] text-muted-foreground/60 flex-shrink-0">
          <span className="flex items-center gap-1"><kbd className="bg-accent/60 px-1 rounded">↑↓</kbd>选择</span>
          <span className="flex items-center gap-1"><kbd className="bg-accent/60 px-1 rounded">↵</kbd>打开</span>
          <span className="flex items-center gap-1"><kbd className="bg-accent/60 px-1 rounded">ESC</kbd>关闭</span>
        </div>
      </div>
    </div>
  );
}
