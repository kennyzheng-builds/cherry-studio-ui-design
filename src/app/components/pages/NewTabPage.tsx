import React, { useState, useRef, useEffect } from 'react';
import {
  Search, X, MessageCircle, Eye, EyeOff, RotateCcw, GripVertical, Settings,
} from 'lucide-react';
import {
  dialogAppIcons, dialogFilterTabs,
  newTabHistoryItems, newTabFileItems, dialogQuickActions,
} from '@/app/config/constants';

interface NewTabPageProps {
  onSelect: (menuItemId: string) => void;
  hiddenApps: Set<string>;
  setHiddenApps: React.Dispatch<React.SetStateAction<Set<string>>>;
  appOrder: string[];
  setAppOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

export function NewTabPage({ onSelect, hiddenApps, setHiddenApps, appOrder, setAppOrder }: NewTabPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('全部');
  const [manageMode, setManageMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const orderedApps = appOrder.map(id => dialogAppIcons.find(a => a.id === id)).filter((a): a is typeof dialogAppIcons[0] => !!a);
  const visibleApps = orderedApps.filter(app => !hiddenApps.has(app.id));
  const toggleAppVisibility = (id: string) => {
    setHiddenApps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const resetApps = () => {
    setHiddenApps(new Set());
    setAppOrder(dialogAppIcons.map(a => a.id));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setAppOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(dragOverIdx, 0, moved);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const matchSearch = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const matchCategory = (cat: string) => activeFilter === '全部' || cat === activeFilter;

  const filteredRecent = newTabHistoryItems.filter(i => matchSearch(i.label + i.desc) && matchCategory(i.category));
  const filteredFiles = newTabFileItems.filter(i => matchSearch(i.label + i.desc) && matchCategory(i.category));
  const filteredActions = activeFilter === '全部' ? dialogQuickActions.filter(i => matchSearch(i.label)) : [];
  const hasResults = filteredRecent.length > 0 || filteredFiles.length > 0 || filteredActions.length > 0;

  return (
    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden relative">
      {/* Manage-apps gear — corner anchored, low-key */}
      <button
        onClick={() => setManageMode(v => !v)}
        className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors z-10 ${
          manageMode
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40'
        }`}
        title="管理快捷应用"
      >
        <Settings size={14} />
      </button>

      <div className="w-full max-w-[720px] mx-auto px-8 pt-[8%] pb-16">
        {/* Hero search */}
        <div className="mb-8">
          <div className="flex items-center gap-3 h-12 px-4 rounded-2xl bg-muted/40 hover:bg-muted/60 focus-within:bg-muted/60 transition-colors">
            <Search size={16} className="text-muted-foreground/60 flex-shrink-0" />
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
          </div>
        </div>

        {/* App launchpad */}
        {!manageMode && visibleApps.length > 0 && (
          <div className="mb-10">
            <div className="grid grid-cols-6 gap-y-4 gap-x-2">
              {visibleApps.map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={app.id}
                    onClick={() => onSelect(app.id)}
                    className="flex flex-col items-center gap-2 py-1.5 rounded-xl group hover:bg-accent/30 transition-colors"
                  >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform ${app.bg} ${app.color} group-hover:scale-[1.04] group-active:scale-[0.96]`}>
                      <Icon size={20} strokeWidth={1.7} />
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

        {/* Manage mode — replaces launchpad when active */}
        {manageMode && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-xs text-muted-foreground">拖拽排序 · 点击眼睛隐藏 / 显示</span>
              <button
                onClick={resetApps}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
              >
                <RotateCcw size={11} />
                重置
              </button>
            </div>
            <div className="space-y-0.5">
              {orderedApps.map((app, idx) => {
                const Icon = app.icon;
                const isHidden = hiddenApps.has(app.id);
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx;
                return (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-all cursor-grab active:cursor-grabbing select-none
                      ${isHidden ? 'opacity-40' : ''}
                      ${isDragging ? 'opacity-50 scale-[0.98]' : ''}
                      ${isDragOver && !isDragging ? 'border-t-2 border-primary/50' : 'border-t-2 border-transparent'}
                      hover:bg-accent/40`}
                  >
                    <GripVertical size={14} className="text-muted-foreground/30 flex-shrink-0" />
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${app.bg} ${app.color}`}>
                      <Icon size={17} />
                    </div>
                    <span className="text-sm text-foreground flex-1">{app.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAppVisibility(app.id); }}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        isHidden
                          ? 'text-muted-foreground/40 hover:text-foreground hover:bg-accent'
                          : 'text-foreground/70 hover:text-foreground hover:bg-accent'
                      }`}
                      title={isHidden ? '显示' : '隐藏'}
                    >
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter pills — segmented-control style, border-less */}
        {!manageMode && (
          <div className="flex items-center gap-1 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {['全部', ...dialogFilterTabs].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded-full text-[12px] whitespace-nowrap transition-colors ${
                  activeFilter === f
                    ? 'bg-foreground/[0.08] text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Lists */}
        {!manageMode && (hasResults ? (
          <div className="space-y-8">
            {/* Recent */}
            {filteredRecent.length > 0 && (
              <section>
                <h2 className="text-[11px] text-muted-foreground/60 mb-2 px-1 tracking-wider uppercase">
                  最近 · {filteredRecent.length}
                </h2>
                <div className="space-y-0.5">
                  {filteredRecent.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={`r-${i}`}
                        onClick={() => onSelect(item.id)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-accent/60 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[13px] text-foreground truncate block">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground/60 truncate block mt-0.5">{item.desc}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40 flex-shrink-0">
                          <MessageCircle size={10} />
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
                <h2 className="text-[11px] text-muted-foreground/60 mb-2 px-1 tracking-wider uppercase">
                  文件 · {filteredFiles.length}
                </h2>
                <div className="space-y-0.5">
                  {filteredFiles.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={`f-${i}`}
                        onClick={() => onSelect(item.id)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[13px] text-foreground truncate block">
                            {item.label} <span className="text-muted-foreground/70">· {item.desc}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 truncate block mt-0.5">{item.meta}</span>
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
                <h2 className="text-[11px] text-muted-foreground/60 mb-2 px-1 tracking-wider uppercase">
                  快捷操作
                </h2>
                <div className="space-y-0.5">
                  {filteredActions.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={`a-${i}`}
                        onClick={() => onSelect(item.id)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-muted-foreground" />
                        </div>
                        <span className="text-[13px] text-foreground flex-1 text-left">{item.label}</span>
                        <kbd className="text-[11px] text-muted-foreground/50 bg-accent/60 px-1.5 py-0.5 rounded flex-shrink-0">{item.shortcut}</kbd>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search size={36} className="text-muted-foreground/20 mb-3" />
            <p className="text-sm text-foreground mb-1">未找到匹配结果</p>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              未能找到与搜索匹配的内容。<br />请尝试调整关键词或筛选条件。
            </p>
            <button
              onClick={() => { setSearch(''); setActiveFilter('全部'); }}
              className="mt-4 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
            >
              清除筛选
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
