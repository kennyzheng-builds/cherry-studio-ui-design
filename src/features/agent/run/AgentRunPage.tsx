import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGlobalActions } from '@/app/context/GlobalActionContext';
import { useIsFloatingWindow } from '@/app/context/FloatingWindowContext';
import {
  ArrowLeft, ChevronDown, ChevronRight, FolderOpen,
  Bot, Circle, PanelRight,
  Sparkles, Plus,
  FileText, Zap, Search as SearchIcon, History,
  Code2, Folder, Tag,
  X,
  Check,
  Edit3, Clock,
  Workflow, Cable, Layers,
  Compass, Wrench, PenTool,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from '@/app/components/Tooltip';
import { ArtifactViewer } from './ArtifactViewer';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ChatPanel } from './ChatPanel';
import { SessionSidebar } from './SessionSidebar';
import type { AgentChatMessage, AgentSession, AgentSessionData } from '@/app/types/agent';
import type { ModelCapability } from '@/app/types/chat';
import { SessionHistoryPage } from './SessionHistoryPage';
import {
  MOCK_SESSIONS, MODELS, SESSION_DATA_MAP, EMPTY_SESSION_DATA,
  DEFAULT_INITIAL_FILES, AGENT_MODEL_CAPABILITY_LABELS,
} from '@/app/mock';
import type { FileNode } from '@/app/types/agent';

// Backward-compatible aliases
type ChatMessage = AgentChatMessage;
type SessionData = AgentSessionData;
type AgentModelCapability = ModelCapability;
import {
  AGENT_PROVIDER_COLORS,
  AGENT_CAP_ICONS, AGENT_CAP_TAG_ICONS, ALL_AGENT_CAPABILITIES,
  RUN_MODE_LABELS, CAP_TAB_CONFIG,
  BUILTIN_TOOLS_CATALOG, MCP_CATALOG, SKILLS_CATALOG,
  BUILTIN_TOOL_CATEGORIES, AGENT_TAGS,
  AVAILABLE_AGENTS,
  type AgentCapTab as CapTab,
  type AgentBuiltinTool as BuiltinTool,
  type AgentMcpService as McpService,
  type AgentSkillItem as AgentSkill,
} from '@/app/config/agentTools';

// ===========================
// Agent Picker Dropdown
// ===========================

function AgentPicker({
  selectedAgent,
  onSelectAgent,
  onCreateNew,
  onAvatarClick,
}: {
  selectedAgent: typeof AVAILABLE_AGENTS[0];
  onSelectAgent: (agent: typeof AVAILABLE_AGENTS[0]) => void;
  onCreateNew: () => void;
  onAvatarClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return AVAILABLE_AGENTS.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase());
      const matchTag = !activeTag || a.tags.includes(activeTag);
      return matchSearch && matchTag;
    });
  }, [search, activeTag]);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) { setSearch(''); setActiveTag(null); }
  };

  return (
    <div className="relative flex items-center">
      {/* Avatar — opens agent info panel */}
      <Tooltip content={"\u667a\u80fd\u4f53\u4fe1\u606f"} side="bottom">
        <button
          onClick={(e) => { e.stopPropagation(); onAvatarClick?.(); }}
          className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent/30 to-accent/10 border border-border/20 flex items-center justify-center text-[12px] flex-shrink-0 hover:from-accent/50 hover:to-accent/25 hover:border-border/40 transition-all duration-150 active:scale-95 mr-1"
        >
          {selectedAgent.avatar}
        </button>
      </Tooltip>

      {/* Name + Chevron — opens picker dropdown */}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1 px-1.5 py-[4px] rounded-md text-[10.5px] transition-all duration-100 ${
          open ? 'bg-accent/25 text-foreground' : 'text-foreground/75 hover:text-foreground hover:bg-accent/15'
        }`}
      >
        <span className="truncate max-w-[160px]">{selectedAgent.name}</span>
        <ChevronDown size={8} className={`text-muted-foreground/50 flex-shrink-0 transition-transform duration-100 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <div>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border/40 rounded-lg shadow-xl shadow-black/10 min-w-[260px]"
              onAnimationComplete={() => searchRef.current?.focus()}
            >
              {/* Search */}
              <div className="px-2 pt-2 pb-1">
                <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-accent/15 border border-border/20">
                  <SearchIcon size={10} className="text-muted-foreground/40 flex-shrink-0" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={"\u641c\u7d22\u667a\u80fd\u4f53..."}
                    className="flex-1 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/30 outline-none min-w-0"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-muted-foreground/30 hover:text-muted-foreground/60">
                      <X size={8} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="px-2 pb-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag size={8} className="text-muted-foreground/30 flex-shrink-0" />
                  {AGENT_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`px-1.5 py-px rounded-full text-[8px] transition-all ${
                        activeTag === tag
                          ? 'bg-foreground/10 text-foreground/70 border border-border/40'
                          : 'bg-accent/20 text-muted-foreground/50 border border-transparent hover:bg-accent/40 hover:text-muted-foreground/70'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border/20 mx-1" />

              {/* Agent list */}
              <div className="p-1.5 max-h-[240px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-2.5 py-3 text-center text-[9px] text-muted-foreground/40">{"\u65e0\u5339\u914d\u7ed3\u679c"}</div>
                ) : (
                  filtered.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { onSelectAgent(a); setOpen(false); }}
                      className={`flex items-center gap-2 w-full px-2 py-[5px] rounded-lg text-[10.5px] transition-all duration-75 mb-px ${
                        selectedAgent.id === a.id
                          ? 'bg-accent/30 text-foreground ring-1 ring-border/30'
                          : 'text-foreground/75 hover:text-foreground hover:bg-accent/15'
                      }`}
                    >
                      <span className="text-[11px] flex-shrink-0">{a.avatar}</span>
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="truncate text-[10.5px]">{a.name}</span>
                        <span className="text-[9px] text-muted-foreground/45">{a.desc}</span>
                      </div>
                      {selectedAgent.id === a.id && (
                        <Check size={9} className="text-cherry-primary flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="h-px bg-border/25 mx-1" />
              <div className="p-1">
                <button
                  onClick={() => { setOpen(false); onCreateNew(); }}
                  className="flex items-center gap-2 w-full px-2.5 py-[6px] rounded-md text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                >
                  <Plus size={10} className="flex-shrink-0" />
                  <span>{"\u65b0\u5efa\u667a\u80fd\u4f53"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================
// Compact Session Selector (single line)
// ===========================

function CompactSessionSelector({
  sessions,
  activeSession,
  onSelectSession,
  onOpenHistory,
}: {
  sessions: AgentSession[];
  activeSession: AgentSession | undefined;
  onSelectSession: (id: string) => void;
  onOpenHistory: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recentSessions = sessions.slice(0, 6);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-[4px] rounded-md text-[10.5px] transition-all duration-100 max-w-[200px] ${
          open ? 'bg-accent/25 text-foreground' : 'text-foreground/75 hover:text-foreground hover:bg-accent/15'
        }`}
      >
        <Bot size={11} className="text-muted-foreground flex-shrink-0" />
        <span className="truncate">
          {activeSession ? activeSession.title : '\u65b0\u4f1a\u8bdd'}
        </span>
        <ChevronDown size={8} className={`text-muted-foreground/50 flex-shrink-0 transition-transform duration-100 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <div>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border/40 rounded-lg shadow-xl shadow-black/10 p-1 min-w-[240px] max-w-[280px]"
            >
              {recentSessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelectSession(s.id); setOpen(false); }}
                  className={`flex items-center gap-2 w-full px-2 py-[5px] rounded-lg text-[10.5px] transition-all duration-75 mb-px ${
                    activeSession?.id === s.id
                      ? 'bg-accent/30 text-foreground ring-1 ring-border/30'
                      : 'text-foreground/75 hover:text-foreground hover:bg-accent/15'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-[3px] flex items-center justify-center flex-shrink-0 ${
                    activeSession?.id === s.id ? 'bg-foreground/10' : 'bg-accent/30'
                  }`}>
                    <Bot size={8} className="text-muted-foreground" />
                  </div>
                  <span className="flex-1 truncate">{s.title}</span>
                  {s.status === 'active' && (
                    <span className="w-[5px] h-[5px] rounded-full bg-cherry-primary flex-shrink-0" />
                  )}
                  <span className="text-[9px] text-muted-foreground/55 flex-shrink-0">{s.timestamp}</span>
                </button>
              ))}

              <div className="h-px bg-border/25 my-1" />
              <button
                onClick={() => { setOpen(false); onOpenHistory(); }}
                className="flex items-center gap-2 w-full px-2.5 py-[6px] rounded-md text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
              >
                <History size={10} className="flex-shrink-0" />
                <span>{"\u67e5\u770b\u5168\u90e8\u5386\u53f2\u8bb0\u5f55"}</span>
                <ChevronRight size={9} className="ml-auto text-muted-foreground/40" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================
// Capability Toggle Switch (mini)
// ===========================

function CapToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-[28px] h-[16px] rounded-full flex-shrink-0 transition-colors duration-150 relative ${
        checked ? 'bg-cherry-primary' : 'bg-muted-foreground/20'
      }`}
    >
      <motion.span
        animate={{ x: checked ? 13 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ===========================
// Add Capability Panel (slide-over inside info panel)
// ===========================

function AddCapabilityPanel({ tab, existingIds, onAdd, onClose, onBrowse }: {
  tab: CapTab;
  existingIds: Set<string>;
  onAdd: (id: string) => void;
  onClose: () => void;
  onBrowse: () => void;
}) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const catalog = useMemo(() => {
    if (tab === 'tools') return BUILTIN_TOOLS_CATALOG.filter(t => !existingIds.has(t.id));
    if (tab === 'mcp') return MCP_CATALOG.filter(m => !existingIds.has(m.id));
    return SKILLS_CATALOG.filter(s => !existingIds.has(s.id));
  }, [tab, existingIds]);

  const filtered = useMemo(() => {
    return catalog.filter((item: any) => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
      const matchCat = !activeCat || (item.category && item.category === activeCat);
      return matchSearch && matchCat;
    });
  }, [catalog, search, activeCat]);

  const grouped = useMemo(() => {
    if (tab !== 'tools') return null;
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const cat = (item as any).category || '\u5176\u4ed6';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [tab, filtered]);

  const tabLabel = tab === 'tools' ? '\u5185\u7f6e\u5de5\u5177' : tab === 'mcp' ? 'MCP Server' : 'Skill';

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 30, opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="absolute inset-0 z-10 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-[38px] flex-shrink-0 border-b border-border/10">
        <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors">
          <ArrowLeft size={12} />
        </button>
        <span className="text-[11px] text-foreground">{"\u6dfb\u52a0"}{tabLabel}</span>
        <span className="text-[9px] text-muted-foreground/40 ml-auto">{catalog.length} {"\u9879\u53ef\u7528"}</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-accent/15 border border-border/15">
          <SearchIcon size={10} className="text-muted-foreground/40 flex-shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`\u641c\u7d22${tabLabel}...`}
            className="flex-1 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/30 outline-none min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground/30 hover:text-muted-foreground/60">
              <X size={8} />
            </button>
          )}
        </div>
      </div>

      {/* Category pills for tools */}
      {tab === 'tools' && (
        <div className="px-3 pb-1.5 flex items-center gap-1 flex-wrap">
          {BUILTIN_TOOL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(activeCat === cat ? null : cat)}
              className={`px-1.5 py-px rounded-full text-[8.5px] transition-all border ${
                activeCat === cat
                  ? 'bg-foreground/8 text-foreground/70 border-border/40'
                  : 'bg-accent/15 text-muted-foreground/50 border-transparent hover:bg-accent/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-border/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <SearchIcon size={16} className="text-muted-foreground/20 mb-2" />
            <span className="text-[10px] text-muted-foreground/40">{"\u65e0\u5339\u914d\u7ed3\u679c"}</span>
          </div>
        ) : tab === 'tools' && grouped ? (
          Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <div className="text-[9px] text-muted-foreground/45 mb-1.5 px-0.5">{cat}</div>
              <div className="space-y-0.5">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 px-2.5 py-[7px] rounded-lg hover:bg-accent/15 transition-colors group">
                    <Wrench size={10} className="text-muted-foreground/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-foreground/75 truncate">{item.name}</div>
                      <div className="text-[9px] text-muted-foreground/40 truncate">{item.desc}</div>
                    </div>
                    <button onClick={() => onAdd(item.id)}
                      className="p-[3px] rounded text-[10px] text-muted-foreground/30 hover:text-cherry-primary hover:bg-cherry-active-bg transition-colors opacity-0 group-hover:opacity-100">
                      <Plus size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-0.5">
            {filtered.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 px-2.5 py-[7px] rounded-lg hover:bg-accent/15 transition-colors group">
                {tab === 'mcp' ? (
                  <Cable size={10} className="text-blue-500/40 flex-shrink-0" />
                ) : (
                  <Zap size={10} className="text-amber-500/40 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-foreground/75 truncate">{item.name}</div>
                  <div className="text-[9px] text-muted-foreground/40 truncate">
                    {tab === 'mcp' ? item.author : item.desc}
                  </div>
                </div>
                <button onClick={() => onAdd(item.id)}
                  className="p-[3px] rounded text-[10px] text-muted-foreground/30 hover:text-cherry-primary hover:bg-cherry-active-bg transition-colors opacity-0 group-hover:opacity-100">
                  <Plus size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 pb-3 pt-1.5 border-t border-border/10 space-y-1.5">
        <button
          onClick={onBrowse}
          className="flex items-center gap-2 w-full px-2.5 py-[7px] rounded-lg text-[10px] text-foreground/60 hover:text-foreground hover:bg-accent/15 transition-colors"
        >
          <Compass size={11} className="text-muted-foreground/50" />
          <span>{"\u53bb\u63a2\u7d22\u6d4f\u89c8"}</span>
          <ChevronRight size={9} className="ml-auto text-muted-foreground/30" />
        </button>
        <button
          className="flex items-center gap-2 w-full px-2.5 py-[7px] rounded-lg text-[10px] text-foreground/60 hover:text-foreground hover:bg-accent/15 transition-colors"
        >
          <PenTool size={10} className="text-muted-foreground/50" />
          <span>{"\u624b\u52a8\u6dfb\u52a0"}</span>
          <ChevronRight size={9} className="ml-auto text-muted-foreground/30" />
        </button>
      </div>
    </motion.div>
  );
}

// ===========================
// Agent Info Panel (floating right panel)
// ===========================

function AgentInfoPanel({ agent, onClose, onEdit }: {
  agent: typeof AVAILABLE_AGENTS[0];
  onClose: () => void;
  onEdit: () => void;
}) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [capTab, setCapTab] = useState<CapTab>('tools');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const modeInfo = RUN_MODE_LABELS[agent.runMode] || RUN_MODE_LABELS.auto;
  const builtinTools = agent.builtinTools || [];
  const mcpServices = agent.mcpServices || [];
  const skills = agent.skills || [];
  const tags = agent.tags || [];

  const toolsByCategory = useMemo(() => {
    const map = new Map<string, BuiltinTool[]>();
    for (const t of builtinTools) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return map;
  }, [builtinTools]);

  const enabledToolCount = builtinTools.filter(t => t.enabled).length;
  const connectedMcpCount = mcpServices.filter(m => m.status === 'connected').length;
  const enabledSkillCount = skills.filter(s => s.enabled).length;

  const existingIds = useMemo(() => {
    if (capTab === 'tools') return new Set(builtinTools.map(t => t.id));
    if (capTab === 'mcp') return new Set(mcpServices.map(m => m.id));
    return new Set(skills.map(s => s.id));
  }, [capTab, builtinTools, mcpServices, skills]);

  const handleAddItem = useCallback((_id: string) => {
    // Mock: just close add panel (real app would add to agent)
    setShowAddPanel(false);
  }, []);

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="absolute top-2 right-2 bottom-2 z-40 bg-background rounded-xl border border-border/25 shadow-2xl shadow-black/12 flex flex-col overflow-hidden"
      style={{ width: 340 }}
    >
      {/* Add panel overlay */}
      <AnimatePresence>
        {showAddPanel && (
          <AddCapabilityPanel
            tab={capTab}
            existingIds={existingIds}
            onAdd={handleAddItem}
            onClose={() => setShowAddPanel(false)}
            onBrowse={onEdit}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[38px] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={12} className="text-muted-foreground" />
          <span className="text-[11px] text-foreground">{"\u667a\u80fd\u4f53\u4fe1\u606f"}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip content={"\u5728\u8d44\u6e90\u5e93\u4e2d\u7f16\u8f91"} side="bottom">
            <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors">
              <Edit3 size={11} />
            </button>
          </Tooltip>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-border/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="p-4 space-y-3.5">
          {/* Avatar + Name + Desc */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 border border-border/20 flex items-center justify-center text-[20px] flex-shrink-0">
              {agent.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] text-foreground mb-0.5">{agent.name}</h3>
              <p className="text-[10px] text-muted-foreground/60 leading-[1.5]">{agent.desc}</p>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground/45 mt-1.5">
                <Clock size={9} />
                <span>{"\u6700\u8fd1\u4f7f\u7528"} {agent.updatedAt}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map(t => (
                <span key={t} className="px-1.5 py-[2px] rounded text-[9px] bg-accent/30 text-foreground/70">{t}</span>
              ))}
            </div>
          )}

          {/* Info rows */}
          <div className="space-y-[6px]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{"\u9ed8\u8ba4\u6a21\u578b"}</span>
              <div className="flex items-center gap-1.5 px-2 py-[3px] rounded-md bg-accent/20">
                <Sparkles size={9} className="text-muted-foreground/50" />
                <span className="text-foreground/80">{agent.model}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{"\u8fd0\u884c\u6a21\u5f0f"}</span>
              <div className="flex items-center gap-1.5">
                <Workflow size={9} className={modeInfo.color} />
                <span className={modeInfo.color}>{modeInfo.label}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{"\u6700\u5927\u8f6e\u6b21"}</span>
              <span className="text-foreground/70 tabular-nums">{agent.maxRounds}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{"\u5de5\u4f5c\u76ee\u5f55"}</span>
              <span className="text-foreground/60 font-mono text-[9px]">{agent.workDir}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{"\u81ea\u52a8\u6279\u51c6"}</span>
              <span className={agent.autoApprove ? 'text-cherry-primary' : 'text-muted-foreground/50'}>
                {agent.autoApprove ? '\u5df2\u5f00\u542f' : '\u5df2\u5173\u95ed'}
              </span>
            </div>
          </div>

          {/* System prompt — collapsible */}
          <div className="rounded-lg bg-muted/15 overflow-hidden">
            <button onClick={() => setPromptExpanded(!promptExpanded)}
              className="flex items-center gap-2 w-full px-3 py-2 text-[10.5px] text-foreground/80 hover:bg-accent/10 transition-colors">
              <FileText size={10} className="text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-left">{"\u7cfb\u7edf\u63d0\u793a\u8bcd"}</span>
              <motion.div animate={{ rotate: promptExpanded ? 90 : 0 }} transition={{ duration: 0.1 }}>
                <ChevronRight size={10} className="text-muted-foreground/50" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {promptExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                  <div className="px-3 pb-3">
                    <pre className="text-[10px] text-foreground/60 leading-[1.7] whitespace-pre-wrap mt-1 font-sans">{agent.systemPrompt}</pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== Capability Extensions — 3 Tabs ===== */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Layers size={10} className="text-muted-foreground" />
                <span className="text-[10.5px] text-foreground/70">{"\u80fd\u529b\u6269\u5c55"}</span>
              </div>
              <Tooltip content={`\u6dfb\u52a0${capTab === 'tools' ? '\u5185\u7f6e\u5de5\u5177' : capTab === 'mcp' ? 'MCP Server' : 'Skill'}`} side="left">
                <button
                  onClick={() => setShowAddPanel(true)}
                  className="p-[3px] rounded text-muted-foreground/40 hover:text-foreground/70 hover:bg-accent/20 transition-colors"
                >
                  <Plus size={11} />
                </button>
              </Tooltip>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-0 mb-2.5 border-b border-border/15">
              {CAP_TAB_CONFIG.map(t => {
                const count = t.key === 'tools' ? `${enabledToolCount}/${builtinTools.length}`
                  : t.key === 'mcp' ? `${connectedMcpCount}/${mcpServices.length}`
                  : `${enabledSkillCount}/${skills.length}`;
                const active = capTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setCapTab(t.key)}
                    className={`relative px-2.5 pb-[7px] pt-[3px] text-[10px] transition-colors ${
                      active ? 'text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground/80'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`ml-1 text-[9px] ${active ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>{count}</span>
                    {active && (
                      <motion.div
                        layoutId="cap-tab-indicator"
                        className="absolute bottom-0 left-1 right-1 h-[1.5px] bg-cherry-primary rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="min-h-[60px]">
              {/* === Built-in Tools Tab === */}
              {capTab === 'tools' && (
                builtinTools.length === 0 ? (
                  <div className="flex flex-col items-center py-5 text-center">
                    <Wrench size={16} className="text-muted-foreground/15 mb-1.5" />
                    <span className="text-[9.5px] text-muted-foreground/35">{"\u672a\u6dfb\u52a0\u5185\u7f6e\u5de5\u5177"}</span>
                    <button onClick={() => setShowAddPanel(true)} className="text-[9px] text-cherry-text-muted hover:text-cherry-primary mt-1 transition-colors">{"+ \u6dfb\u52a0\u5de5\u5177"}</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(toolsByCategory.entries()).map(([cat, items]) => {
                      const catEnabled = items.filter(t => t.enabled).length;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1 px-0.5">
                            <span className="text-[9px] text-muted-foreground/45">{cat}</span>
                            <span className="text-[8px] text-muted-foreground/30">{catEnabled}/{items.length}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {items.map(tool => (
                              <div key={tool.id} className="flex items-center gap-2 px-2 py-[6px] rounded-md hover:bg-accent/10 transition-colors group">
                                <Wrench size={10} className={`flex-shrink-0 ${tool.enabled ? 'text-foreground/50' : 'text-muted-foreground/25'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[9.5px] truncate ${tool.enabled ? 'text-foreground/70' : 'text-muted-foreground/35'}`}>{tool.name}</div>
                                  <div className="text-[8px] text-muted-foreground/30 truncate">{tool.desc}</div>
                                </div>
                                <CapToggle checked={tool.enabled} onChange={() => {}} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* === MCP Tab === */}
              {capTab === 'mcp' && (
                mcpServices.length === 0 ? (
                  <div className="flex flex-col items-center py-5 text-center">
                    <Cable size={16} className="text-muted-foreground/15 mb-1.5" />
                    <span className="text-[9.5px] text-muted-foreground/35">{"\u672a\u6dfb\u52a0 MCP Server"}</span>
                    <button onClick={() => setShowAddPanel(true)} className="text-[9px] text-cherry-text-muted hover:text-cherry-primary mt-1 transition-colors">{"+ \u6dfb\u52a0 MCP"}</button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {mcpServices.map(svc => (
                      <div key={svc.id} className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg hover:bg-accent/10 transition-colors group">
                        <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <Cable size={11} className="text-blue-500/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-foreground/75 truncate">{svc.name}</div>
                          <div className="text-[8.5px] text-muted-foreground/35 truncate">{svc.desc}</div>
                        </div>
                        <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${
                          svc.status === 'connected' ? 'bg-cherry-primary' : 'bg-muted-foreground/25'
                        }`} />
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* === Skills Tab === */}
              {capTab === 'skills' && (
                skills.length === 0 ? (
                  <div className="flex flex-col items-center py-5 text-center">
                    <Zap size={16} className="text-muted-foreground/15 mb-1.5" />
                    <span className="text-[9.5px] text-muted-foreground/35">{"\u672a\u6dfb\u52a0 Skill"}</span>
                    <button onClick={() => setShowAddPanel(true)} className="text-[9px] text-cherry-text-muted hover:text-cherry-primary mt-1 transition-colors">{"+ \u6dfb\u52a0 Skill"}</button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {skills.map(skill => (
                      <div key={skill.id} className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg hover:bg-accent/10 transition-colors">
                        <Zap size={10} className={`flex-shrink-0 ${skill.enabled ? 'text-amber-500/60' : 'text-muted-foreground/25'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] truncate ${skill.enabled ? 'text-foreground/75' : 'text-muted-foreground/40'}`}>{skill.name}</div>
                          <div className="text-[8.5px] text-muted-foreground/35 truncate">{skill.desc}</div>
                        </div>
                        <CapToggle checked={skill.enabled} onChange={() => {}} />
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/40 pt-2 border-t border-border/10">
            <span>{"\u521b\u5efa\u4e8e"} {agent.createdAt}</span>
            <span>ID: {agent.id}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================
// Agent Run Page
// ===========================

export function AgentRunPage({ onBack, tabId, initialSessionId }: { onBack?: () => void; tabId?: string; initialSessionId?: string } = {}) {
  const { navigateToLibrary: _navLib, changeTabTitle: onTabTitleChange, openSettings: onOpenSettings, requestOpenSession } = useGlobalActions();
  const onNavigateToLibrary = () => _navLib('agent');
  const [sessions, setSessions] = useState<AgentSession[]>(MOCK_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId ?? null);
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({});

  // Multi-file tab state. Empty by default — files only open when the user
  // explicitly clicks a file-mention chip in agent messages, the file index
  // popover, or the top-right "open work panel" button. The right pane is
  // never auto-populated when entering a session.
  const [openedFiles, setOpenedFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [mdlSearch, setMdlSearch] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>(() => MODELS[0].provider);
  const [mdlCapFilter, setMdlCapFilter] = useState<AgentModelCapability | null>(null);
  const mdlSearchRef = useRef<HTMLInputElement>(null);
  const MODEL_PROVIDERS = useMemo(() => Array.from(new Set(MODELS.map(m => m.provider))), []);
  const providerModels = useMemo(() => {
    return MODELS.filter(m => {
      const matchProvider = m.provider === activeProvider;
      const matchSearch = !mdlSearch || m.name.toLowerCase().includes(mdlSearch.toLowerCase());
      const matchCap = !mdlCapFilter || m.capabilities.includes(mdlCapFilter);
      return matchProvider && matchSearch && matchCap;
    });
  }, [activeProvider, mdlSearch, mdlCapFilter]);
  // Right work pane is closed by default. It only opens when the user clicks
  // an artifact (file mention chip in chat, file index popover, etc.) or the
  // explicit "open work panel" button. Conversation is the primary surface;
  // the preview is a lazy on-demand companion (Cursor / Canvas pattern).
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Collapsible left session list (mirror real Cherry Studio). Hidden in
  // floating popouts since a popout is a single-session window.
  const [showSessionList, setShowSessionList] = useState(true);
  const isFloating = useIsFloatingWindow();
  const [selectedAgent, setSelectedAgent] = useState(AVAILABLE_AGENTS[0]);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const [showAgentInfo, setShowAgentInfo] = useState(false);

  const sessionData: SessionData = useMemo(() => {
    if (!activeSessionId) return EMPTY_SESSION_DATA;
    return SESSION_DATA_MAP[activeSessionId] || EMPTY_SESSION_DATA;
  }, [activeSessionId]);

  const messages = localMessages[activeSessionId || ''] ?? sessionData.messages;
  const hasMessages = messages.length > 0;
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Sync session name to tab title. We target our own tabId so this update
  // never clobbers another tab when kept-alive in background.
  useEffect(() => {
    if (!tabId) return;
    onTabTitleChange(activeSession ? activeSession.title : '\u5de5\u4f5c', tabId);
  }, [activeSession, onTabTitleChange, tabId]);

  const fileContent = activeFile ? (sessionData.fileContents[activeFile] || null) : null;

  // Resolve a readable label (basename) for a file tab key
  const getFileLabel = useCallback((key: string): string => {
    if (key.startsWith('output:')) {
      const id = key.slice('output:'.length);
      const out = sessionData.outputFiles.find(f => f.id === id);
      return out?.name || id;
    }
    return key.split('/').pop() || key;
  }, [sessionData.outputFiles]);

  // Open a file: add to openedFiles if not present, set as active
  const handleOpenFile = useCallback((key: string) => {
    setOpenedFiles(prev => prev.includes(key) ? prev : [...prev, key]);
    setActiveFile(key);
    setShowPreview(true);
  }, []);

  // Select an already-open file tab
  const handleSelectFile = useCallback((key: string) => {
    setActiveFile(key);
  }, []);

  // Close a file tab; if it was active, fall back to neighbor
  const handleCloseFile = useCallback((key: string) => {
    setOpenedFiles(prev => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const next = prev.filter(k => k !== key);
      // If closed the active tab, pick a neighbor
      setActiveFile(current => {
        if (current !== key) return current;
        if (next.length === 0) return null;
        const fallbackIdx = Math.min(idx, next.length - 1);
        return next[fallbackIdx];
      });
      return next;
    });
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    // Pin-protected navigation: if the current tab is pinned/home/miniapp, open in new tab
    // instead of replacing the pinned tab's session.
    const session = sessions.find(s => s.id === id);
    if (requestOpenSession(id, session?.title)) return;

    // Switching session resets the work pane state — the new session starts
    // with no open files and the preview hidden. Files are opened on demand
    // when the user clicks a file mention in the conversation.
    setActiveSessionId(id);
    setOpenedFiles([]);
    setActiveFile(null);
    setShowPreview(false);
  }, [sessions, requestOpenSession]);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setShowPreview(false);
      setOpenedFiles([]);
      setActiveFile(null);
    }
  }, [activeSessionId]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setShowPreview(false);
    setOpenedFiles([]);
    setActiveFile(null);
  }, []);

  const handleUpdateSession = useCallback((id: string, updates: Partial<AgentSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Auto-create session if none active
    let key = activeSessionId || '';
    if (!activeSessionId) {
      const newId = `new-${Date.now()}`;
      const newSession: AgentSession = {
        id: newId,
        title: text.slice(0, 40),
        agentName: '\u5168\u6808\u5de5\u7a0b\u5e08',
        lastMessage: text,
        timestamp: ts,
        messageCount: 1,
        status: 'active',
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newId);
      key = newId;
    }

    const addMsg = (msg: ChatMessage) => {
      setLocalMessages(prev => ({
        ...prev,
        [key]: [...(prev[key] ?? sessionData.messages), msg],
      }));
    };

    if (!localMessages[key] && !SESSION_DATA_MAP[key]) {
      setLocalMessages(prev => ({ ...prev, [key]: [] }));
    }

    const userMsg: ChatMessage = { id: `m${Date.now()}`, role: 'user', content: text, timestamp: ts };
    setLocalMessages(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []), userMsg],
    }));

    if (key.startsWith('new-')) {
      setSessions(prev => prev.map(s =>
        s.id === key
          ? { ...s, title: text.slice(0, 40), lastMessage: text, messageCount: (s.messageCount || 0) + 1 }
          : s
      ));
    }

    setTimeout(() => {
      addMsg({ id: `m${Date.now() + 1}`, role: 'agent', thinking: '\u6b63\u5728\u5206\u6790\u9700\u6c42\u5e76\u89c4\u5212\u5b9e\u73b0\u65b9\u6848...', timestamp: ts });
    }, 600);
    setTimeout(() => {
      addMsg({ id: `m${Date.now() + 2}`, role: 'agent', toolCall: { name: '\u5206\u6790\u9879\u76ee\u7ed3\u6784', status: 'running' }, timestamp: ts });
    }, 1200);
    setTimeout(() => {
      addMsg({ id: `m${Date.now() + 3}`, role: 'agent', content: '\u6536\u5230\uff0c\u6b63\u5728\u4e3a\u4f60\u5904\u7406\u4e2d...', timestamp: ts });
    }, 2200);
  }, [activeSessionId, sessionData.messages, localMessages]);

  const handleResolveUI = useCallback((msgId: string, value: string) => {
    const key = activeSessionId || '';
    setLocalMessages(prev => {
      const msgs = prev[key] ?? sessionData.messages;
      return {
        ...prev,
        [key]: msgs.map(m => {
          if (m.id === msgId && m.generativeUI) {
            return { ...m, generativeUI: { ...m.generativeUI, resolved: true, resolvedValue: value } };
          }
          return m;
        }),
      };
    });
  }, [activeSessionId, sessionData.messages]);

  if (MODELS.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background select-none relative">
        <EmptyState
          preset="no-model"
          description={"\u8bf7\u5148\u524d\u5f80\u8bbe\u7f6e\u9875\u9762\u6dfb\u52a0\u6a21\u578b\u670d\u52a1\u5546\u5e76\u542f\u7528\u6a21\u578b\uff0c\u624d\u80fd\u5f00\u59cb\u5de5\u4f5c"}
          actionLabel={"\u524d\u5f80\u8bbe\u7f6e"}
          onAction={onOpenSettings}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background select-none relative">
      {/* ===== Header ===== */}
      <header className="flex items-center justify-between px-3 border-b border-transparent flex-shrink-0 h-[40px]">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button onClick={onBack}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors">
              <ArrowLeft size={13} />
            </button>
          )}

          {/* Session list toggle — mirror AssistantRunPage, hidden in floating */}
          {!isFloating && (
            <Tooltip content={showSessionList ? '收起会话列表' : '展开会话列表'} side="bottom">
              <button
                onClick={() => setShowSessionList(v => !v)}
                className={`p-1.5 rounded transition-colors ${
                  showSessionList
                    ? 'text-foreground/80 bg-accent/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/15'
                }`}
              >
                {showSessionList ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
              </button>
            </Tooltip>
          )}

          {/* Agent picker — always visible */}
          <AgentPicker
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            onCreateNew={() => onNavigateToLibrary?.()}
            onAvatarClick={() => setShowAgentInfo(true)}
          />

          {/* Model picker — always visible */}
          <div className="w-px h-3.5 bg-border/25" />
          <div className="relative">
            <button onClick={() => { setShowModelPicker(!showModelPicker); if (!showModelPicker) { setMdlSearch(''); setMdlCapFilter(null); setActiveProvider(selectedModel.provider); } }}
              className={`flex items-center gap-1 px-1.5 py-[3px] rounded text-[9.5px] transition-all duration-100 ${
                showModelPicker
                  ? 'bg-accent/25 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/15'
              }`}>
              <span>{selectedModel.name}</span>
              <ChevronDown size={7} className={`text-muted-foreground/50 transition-transform duration-100 ${showModelPicker ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showModelPicker && (
                <div>
                  <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.1 }}
                    className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border/40 rounded-lg shadow-xl shadow-black/8 w-[360px]"
                    onAnimationComplete={() => mdlSearchRef.current?.focus()}
                  >
                    {/* Search */}
                    <div className="px-2 pt-2 pb-1.5">
                      <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-accent/15 border border-border/20">
                        <SearchIcon size={10} className="text-muted-foreground/40 flex-shrink-0" />
                        <input ref={mdlSearchRef} value={mdlSearch} onChange={e => setMdlSearch(e.target.value)}
                          placeholder={"\u641c\u7d22\u6a21\u578b..."}
                          className="flex-1 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/30 outline-none min-w-0" />
                        {mdlSearch && <button onClick={() => setMdlSearch('')} className="text-muted-foreground/30 hover:text-muted-foreground/60"><X size={8} /></button>}
                      </div>
                    </div>
                    {/* Tag filters */}
                    <div className="px-2.5 pb-1 pt-0.5 flex items-center gap-1 flex-wrap">
                      {ALL_AGENT_CAPABILITIES.map(cap => {
                        const Icon = AGENT_CAP_TAG_ICONS[cap];
                        const active = mdlCapFilter === cap;
                        return (
                          <button key={cap} onClick={() => setMdlCapFilter(active ? null : cap)}
                            className={`flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[9px] transition-all border ${
                              active
                                ? 'bg-foreground/8 text-foreground/80 border-border/50'
                                : 'bg-accent/15 text-muted-foreground/55 border-transparent hover:bg-accent/30 hover:text-muted-foreground/75'
                            }`}>
                            <Icon size={9} />
                            <span>{AGENT_MODEL_CAPABILITY_LABELS[cap]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="h-px bg-border/20" />
                    {/* Two-column: providers | models */}
                    <div className="flex h-[240px]">
                      {/* Left: providers */}
                      <div className="w-[110px] border-r border-border/20 py-1 overflow-y-auto flex-shrink-0">
                        {MODEL_PROVIDERS.map(p => {
                          const count = MODELS.filter(m => m.provider === p && (!mdlCapFilter || m.capabilities.includes(mdlCapFilter))).length;
                          const provColor = AGENT_PROVIDER_COLORS[p] || 'bg-gray-400';
                          return (
                            <button key={p} onClick={() => setActiveProvider(p)}
                              className={`flex items-center gap-1.5 w-full px-2.5 py-[6px] text-[10px] transition-all duration-75 ${
                                activeProvider === p
                                  ? 'bg-accent/30 text-foreground'
                                  : 'text-foreground/60 hover:text-foreground hover:bg-accent/15'
                              }`}>
                              <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${provColor}`} />
                              <span className="truncate flex-1">{p}</span>
                              <span className="text-[8px] text-muted-foreground/40 flex-shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Right: models (single select only) */}
                      <div className="flex-1 py-1 px-1.5 overflow-y-auto">
                        {providerModels.length === 0 ? (
                          <div className="px-2.5 py-3 text-center text-[9px] text-muted-foreground/40">{"\u65e0\u5339\u914d\u7ed3\u679c"}</div>
                        ) : (
                          providerModels.map(m => {
                            const selected = selectedModel.id === m.id;
                            return (
                              <button key={m.id} onClick={() => { setSelectedModel(m); setShowModelPicker(false); }}
                                className={`flex items-center gap-2 w-full px-2 py-[5px] rounded-lg text-[10px] transition-all duration-75 mb-px ${
                                  selected ? 'bg-accent/30 ring-1 ring-border/30' : 'text-foreground/70 hover:text-foreground hover:bg-accent/15'
                                }`}>
                                <span className={`flex-1 text-left truncate ${selected ? 'text-foreground' : ''}`}>{m.name}</span>
                                <div className="flex items-center gap-[3px] flex-shrink-0">
                                  {m.capabilities.map(cap => {
                                    const ci = AGENT_CAP_ICONS[cap];
                                    const CapIcon = ci.icon;
                                    return <CapIcon key={cap} size={10} className={`${ci.color}/40`} />;
                                  })}
                                </div>
                                {selected && <Check size={9} className="text-cherry-primary flex-shrink-0 ml-0.5" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* WorkDir — always visible */}
          <div className="w-px h-3.5 bg-border/25" />
          <button className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9.5px] text-muted-foreground hover:text-foreground/80 hover:bg-accent/15 transition-colors font-mono">
            <FolderOpen size={9} />
            {sessionData.workDir || '~/projects'}
          </button>

          {/* Running status indicator — session title now comes from the left list */}
          {hasMessages && sessionData.workDir && (
            <div className="flex items-center gap-1.5">
              <div className="w-px h-3.5 bg-border/25" />
              <div className="flex items-center gap-1 text-[9px] text-cherry-primary-dark">
                <Circle size={5} className="fill-cherry-primary" />
                {activeSession?.status === 'active' ? '\u8fd0\u884c\u4e2d' : '\u5df2\u5b8c\u6210'}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* History — always visible */}
          <Tooltip content={"\u5386\u53f2\u8bb0\u5f55"} side="bottom"><button onClick={() => setShowHistory(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors">
            <History size={13} />
          </button></Tooltip>

          {/* Show work panel — when hidden */}
          {!showPreview && (
            <div className="flex items-center gap-0.5">
              <div className="w-px h-3.5 bg-border/25 mx-0.5" />
              <Tooltip content={"\u6253\u5f00\u5de5\u4f5c\u9762\u677f"} side="bottom"><button onClick={() => setShowPreview(true)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors">
                <PanelRight size={13} />
              </button></Tooltip>
            </div>
          )}
        </div>
      </header>

      {/* ===== Main Content =====
          Layout philosophy (Cursor/Canvas-style, lazy right pane):
          - Default: ChatPanel fills available width (no persistent file tree)
          - Right WorkPane opens on demand (artifact click, file mention, or top-right button)
          - WorkPane internally manages multi-file tabs + 📁 file index popover
          - No per-session "explorer" column; file discovery happens via popover or chat mentions
      */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Leftmost: Session list (persistent, mirrors Cherry Studio) */}
        <AnimatePresence initial={false}>
          {showSessionList && !isFloating && !previewMaximized && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 224, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="flex-shrink-0 overflow-hidden border-r border-border/30"
            >
              <div style={{ width: 224 }} className="h-full">
                <SessionSidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={handleSelectSession}
                  onNewSession={handleNewSession}
                  onDeleteSession={handleDeleteSession}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat column — occupies remaining width. Uses ChatPanel for both
            empty and active states so the shell (composer at bottom, etc.)
            is consistent with Chat / Assistant pages. */}
        {!previewMaximized && (
          <div
            className="flex-1 min-w-[320px] overflow-hidden"
          >
            <ChatPanel
              messages={messages}
              steps={sessionData.steps}
              onSendMessage={handleSendMessage}
              onResolveUI={handleResolveUI}
              onAvatarClick={() => setShowAgentInfo(true)}
              onOpenFile={handleOpenFile}
              placeholder={hasMessages ? '输入消息...' : '描述你想要构建的内容...'}
              emptyState={
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center max-w-[360px] w-full"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-accent/60 to-accent/30 border border-border/30 flex items-center justify-center mb-5">
                    <Sparkles size={22} strokeWidth={1.3} className="text-foreground/40" />
                  </div>
                  <h2 className="text-[14px] text-foreground tracking-[-0.01em]">需要我帮你构建什么？</h2>
                  <p className="text-[11px] text-muted-foreground/60 text-center leading-[1.6] mt-1.5">
                    向 {selectedAgent.name} 提问，支持生成代码、文档和可交付成果
                  </p>
                </motion.div>
              }
            />
          </div>
        )}

        {/* Right WorkPane — tight Claude/Cursor-style: single vertical border, no gap, no card */}
        <AnimatePresence initial={false}>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className={`flex flex-col overflow-hidden ${
                previewMaximized ? 'flex-1' : 'flex-[1.3] min-w-[420px] max-w-[920px] border-l border-border/40'
              }`}
            >
              <ArtifactViewer
                openedFiles={openedFiles}
                activeFile={activeFile}
                onSelectFile={handleSelectFile}
                onCloseFile={handleCloseFile}
                onOpenFile={handleOpenFile}
                fileContent={fileContent}
                getFileLabel={getFileLabel}
                allFiles={sessionData.files.length > 0 ? sessionData.files : (DEFAULT_INITIAL_FILES as FileNode[])}
                outputFiles={sessionData.outputFiles}
                previewUrl={null}
                previewHtml={sessionData.previewHtml}
                hasArtifact={!!sessionData.previewHtml || !!fileContent || openedFiles.length > 0}
                onClosePanel={() => setShowPreview(false)}
                maximized={previewMaximized}
                onToggleMaximize={() => setPreviewMaximized(!previewMaximized)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== History Overlay ===== */}
      <AnimatePresence>
        {showHistory && (
          <SessionHistoryPage
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onUpdateSession={handleUpdateSession}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Agent Info Overlay ===== */}
      <AnimatePresence>
        {showAgentInfo && (
          <AgentInfoPanel
            agent={selectedAgent}
            onClose={() => setShowAgentInfo(false)}
            onEdit={() => onNavigateToLibrary?.()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
