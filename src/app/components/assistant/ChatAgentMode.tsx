// ===========================
// Chat / Agent 融合 — V1 shared UI (rebuilt on the LATEST UI)
// ===========================
// Components + helpers powering the unified conversation surface:
//   - ConvMode type + keyword escalation / model-gate helpers (ported logic)
//   - ModeSwitcher: segmented 聊天/任务 control for the composer toolbar
//   - TurnMetaLine: per-turn meta line (Worked for Xs / Thought for Xs)
//   - AgentTrace / ThinkingTrace: inline expandable traces
//   - EscalationCard: inline Chat → 任务模式 upgrade bridge + workDir picker
//   - ModelGatePrompt: model-compatibility gate ("切到兼容模型")
//   - AgentCanvasView: right-canvas file tree + outputs (reuses FileExplorer / ArtifactViewer)
//
// Markup is rebuilt against the new design system (cherry-* accent tokens,
// muted-foreground scale, motion/react, lucide). Rendering of agent products
// leans entirely on the existing FileExplorer / ArtifactViewer component library —
// nothing is duplicated.

import React, { useState } from 'react';
import {
  MessageCircle, Zap, ChevronRight, ChevronDown, Loader2, Check, X,
  Brain, FolderOpen, Lock, ArrowRight, Sparkles,
  Search, Globe, Pencil, Package, Settings, Play, Trash2, Eye, Rocket, Code2, Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from '@/app/components/Tooltip';
import type { ModelInfo, WorkflowStep, ToolCallData } from '@/app/types/chat';
import type { FileNode, OutputFile } from '@/app/types/agent';
import { FileExplorer } from '@/features/agent/run/FileExplorer';
import { ArtifactViewer } from '@/features/agent/run/ArtifactViewer';
import { ASSISTANT_MODELS } from '@/app/config/models';

// ===========================
// Mode type + ported helpers
// ===========================

export type ConvMode = 'chat' | 'agent';

// Keywords that signal a request touching real agent capability (local files /
// shell / multi-round autonomy). Demo heuristic ported from the reference impl.
const ESCALATION_KEYWORDS = [
  '文件', '文件夹', '桌面', '整理', '归类', '项目', '运行', '跑', '执行',
  '部署', '构建', '安装', '脚本', '命令', '截图', '目录', 'build',
  '本地', '下载到', '保存到', '创建项目', '搭建', '初始化',
];

export function needsAgent(text: string): boolean {
  const t = text.toLowerCase();
  return ESCALATION_KEYWORDS.some(k => t.includes(k.toLowerCase()));
}

export function modelHasTools(modelId: string): boolean {
  const m = ASSISTANT_MODELS.find(x => x.id === modelId);
  return !!m?.capabilities.includes('tools');
}

// First tools-capable model from the same provider (fallback: any tools model).
export function suggestCompatibleModel(currentModelId: string): ModelInfo | undefined {
  const cur = ASSISTANT_MODELS.find(x => x.id === currentModelId);
  const sameProvider = ASSISTANT_MODELS.find(m => m.provider === cur?.provider && m.capabilities.includes('tools'));
  return sameProvider || ASSISTANT_MODELS.find(m => m.capabilities.includes('tools'));
}

// Smart default workDir for the escalation bridge — 桌面 hint wins.
export function suggestWorkDir(text: string): string {
  if (text.includes('桌面')) return '~/Desktop';
  if (text.includes('下载')) return '~/Downloads';
  if (text.includes('文档')) return '~/Documents';
  return '~/Projects';
}

// ===========================
// Mode Switcher — single pill + upward dropdown list (IMA-style).
// Shows the current mode; click to expand a list of modes with descriptions.
// ===========================

const MODE_OPTIONS: { key: ConvMode; title: string; desc: string }[] = [
  { key: 'chat', title: '聊天模式', desc: '多轮问答、写作、查资料 — 快速且省，不动你的电脑' },
  { key: 'agent', title: '任务模式', desc: '在你电脑上读写文件、跑命令，多轮自主完成并交付' },
];

export function ModeSwitcher({
  mode, onChange, toolsEnabled, onLockedClick,
}: {
  mode: ConvMode;
  onChange: (m: ConvMode) => void;
  /** Whether the current conversation model supports tools (任务 requires it). */
  toolsEnabled: boolean;
  /** Called when the user picks the locked 任务 option. */
  onLockedClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isAgent = mode === 'agent';

  const select = (key: ConvMode) => {
    if (key === 'agent' && !toolsEnabled) { setOpen(false); onLockedClick(); return; }
    onChange(key);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger pill — shows current mode */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-xs border transition-colors ${
          open ? 'border-border/70 bg-accent/30' : 'border-border/50 bg-background hover:bg-accent/25'
        }`}
      >
        {isAgent
          ? <Zap size={12} strokeWidth={1.7} className="text-cherry-primary-dark" />
          : <MessageCircle size={12} strokeWidth={1.7} className="text-muted-foreground" />}
        <span className={isAgent ? 'text-cherry-primary-dark' : 'text-foreground/80'}>
          {isAgent ? '任务模式' : '聊天模式'}
        </span>
        <ChevronDown size={9} className={`text-muted-foreground/50 transition-transform duration-100 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 mb-1.5 z-[56] w-[268px] bg-popover border border-border/40 rounded-xl shadow-2xl shadow-black/12 overflow-hidden p-1"
            >
              {MODE_OPTIONS.map(o => {
                const active = mode === o.key;
                const locked = o.key === 'agent' && !toolsEnabled;
                const Icon = o.key === 'agent' ? Zap : MessageCircle;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => select(o.key)}
                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      active ? 'bg-cherry-active-bg' : 'hover:bg-accent/30'
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.6} className={`mt-[1px] flex-shrink-0 ${active ? 'text-cherry-primary-dark' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${active ? 'text-cherry-primary-dark' : 'text-foreground/85'}`}>{o.title}</span>
                        {locked && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                            <Lock size={8} strokeWidth={1.8} />需工具模型
                          </span>
                        )}
                        {active && <Check size={12} className="ml-auto text-cherry-primary-dark flex-shrink-0" />}
                      </div>
                      <div className={`text-[11px] leading-[1.5] mt-0.5 ${active ? 'text-cherry-primary-dark/70' : 'text-muted-foreground/60'}`}>
                        {o.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================
// Per-turn meta line (Claude-Code style) — mode-anchored
// ===========================

export function TurnMetaLine({
  mode, duration, expanded, onToggle,
}: {
  mode: ConvMode;
  duration: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = mode === 'agent' ? `Worked for ${duration}` : `Thought for ${duration}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 mb-0.5 text-xs text-muted-foreground/55 hover:text-muted-foreground/85 transition-colors"
    >
      {mode === 'agent'
        ? <Sparkles size={10} className="text-muted-foreground/45" />
        : <Brain size={10} className="text-muted-foreground/45" />}
      <span>{label}</span>
      <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.1 }} className="flex items-center">
        <ChevronRight size={10} className="text-muted-foreground/40" />
      </motion.span>
    </button>
  );
}

// ===========================
// Inline tool-call / step trace
// ===========================

function traceIcon(name: string, size = 11): React.ReactNode {
  const n = name.toLowerCase();
  const cls = 'text-muted-foreground flex-shrink-0';
  if (n.includes('search') || n.includes('find') || n.includes('analyz')) return <Search size={size} className={cls} />;
  if (n.includes('web') || n.includes('browse') || n.includes('http') || n.includes('fetch') || n.includes('scrape')) return <Globe size={size} className={cls} />;
  if (n.includes('write') || n.includes('edit') || n.includes('update') || n.includes('create') || n.includes('modify')) return <Pencil size={size} className={cls} />;
  if (n.includes('install') || n.includes('npm') || n.includes('pnpm') || n.includes('yarn')) return <Package size={size} className={cls} />;
  if (n.includes('config') || n.includes('init') || n.includes('setup')) return <Settings size={size} className={cls} />;
  if (n.includes('run') || n.includes('exec') || n.includes('dev') || n.includes('npx') || n.includes('vite')) return <Play size={size} className={cls} />;
  if (n.includes('delete') || n.includes('remove') || n.includes('clean')) return <Trash2 size={size} className={cls} />;
  if (n.includes('read') || n.includes('view') || n.includes('check')) return <Eye size={size} className={cls} />;
  if (n.includes('build') || n.includes('deploy')) return <Rocket size={size} className={cls} />;
  if (n.includes('folder') || n.includes('dir') || n.includes('mkdir') || n.includes('move')) return <FolderOpen size={size} className={cls} />;
  if (n.includes('code') || n.includes('component')) return <Code2 size={size} className={cls} />;
  return <Terminal size={size} className={cls} />;
}

function ToolCallRow({ tc }: { tc: ToolCallData }) {
  return (
    <div className="flex items-center gap-2 py-[4px] px-1 text-xs">
      {traceIcon(tc.name)}
      <span className="text-foreground/75 flex-1 truncate font-mono text-xs">{tc.name}</span>
      {tc.status === 'running' ? (
        <Loader2 size={9} className="text-cherry-primary animate-spin flex-shrink-0" />
      ) : tc.status === 'error' ? (
        <X size={9} className="text-destructive flex-shrink-0" />
      ) : (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tc.duration && <span className="text-xs text-muted-foreground/55 tabular-nums">{tc.duration}</span>}
          <Check size={9} className="text-cherry-primary-dark" />
        </div>
      )}
    </div>
  );
}

/** Inline agent trace shown when the user expands a 任务 turn's meta line. */
export function AgentTrace({ steps, toolCalls, thinking }: {
  steps?: WorkflowStep[];
  toolCalls?: ToolCallData[];
  thinking?: string;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.14 }}
      className="overflow-hidden"
    >
      <div className="ml-2 pl-2.5 border-l border-border/30 mb-1.5 py-0.5">
        {thinking && (
          <div className="mb-1.5 bg-muted/40 rounded-md px-2.5 py-1.5">
            <p className="text-xs text-muted-foreground/70 leading-[1.65] whitespace-pre-wrap">{thinking}</p>
          </div>
        )}
        {toolCalls && toolCalls.map((tc, i) => <ToolCallRow key={i} tc={tc} />)}
        {toolCalls && toolCalls.length > 0 && steps && steps.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5 mb-0.5 px-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">步骤</span>
            <div className="flex-1 h-px bg-border/25" />
          </div>
        )}
        {steps && steps.map(s => (
          <div key={s.id} className="flex items-center gap-2 py-[4px] px-1 text-xs">
            {s.status === 'done'
              ? <Check size={11} className="text-cherry-primary-dark flex-shrink-0" />
              : s.status === 'running'
                ? <Loader2 size={10} className="text-cherry-primary animate-spin flex-shrink-0" />
                : <div className="w-[11px] h-[11px] rounded-full border border-muted-foreground/30 flex-shrink-0" />}
            <span className={`flex-1 truncate ${
              s.status === 'pending' ? 'text-muted-foreground/45' : 'text-foreground/75'
            }`}>{s.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ===========================
// Thinking trace (Chat turn with thinking)
// ===========================

export function ThinkingTrace({ thinking }: { thinking: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.14 }}
      className="overflow-hidden"
    >
      <div className="ml-2 pl-2.5 border-l border-border/30 mb-1.5 bg-muted/30 rounded-r-md">
        <p className="text-xs text-muted-foreground/70 leading-[1.7] whitespace-pre-wrap px-2 py-1.5">{thinking}</p>
      </div>
    </motion.div>
  );
}

// ===========================
// Escalation bridge card (Chat → 任务模式)
// ===========================

const WORKDIR_OPTIONS = ['~/Desktop', '~/Documents', '~/Projects', '~/Downloads'];

export function EscalationCard({
  defaultWorkDir, onConfirm, onContinueChat,
}: {
  defaultWorkDir: string;
  onConfirm: (workDir: string) => void;
  /** Keep chat mode and send the message anyway — never drop the user's message. */
  onContinueChat: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="my-1 flex items-center gap-2.5 rounded-xl border border-cherry-active-border bg-cherry-active-bg px-3 py-2 max-w-[480px]"
    >
      <Zap size={13} className="text-cherry-primary-dark flex-shrink-0" />
      <p className="flex-1 min-w-0 text-xs text-foreground/85 leading-[1.5]">
        这个需要切到<span className="text-cherry-primary-dark">「任务模式」</span>才能动手做
      </p>
      <button
        type="button"
        onClick={() => onConfirm(defaultWorkDir)}
        className="flex items-center gap-1 px-2.5 py-[5px] rounded-lg bg-cherry-primary text-white text-xs hover:bg-cherry-primary-hover transition-colors active:scale-[0.97] flex-shrink-0"
      >
        切到任务模式
        <ArrowRight size={11} />
      </button>
      <button
        type="button"
        onClick={onContinueChat}
        className="px-2 py-[5px] rounded-lg text-xs text-muted-foreground/70 hover:text-foreground hover:bg-accent/30 transition-colors flex-shrink-0"
      >
        继续聊天
      </button>
    </motion.div>
  );
}

// ===========================
// Model compatibility gate prompt
// ===========================

export function ModelGatePrompt({
  targetModelName, onConfirm, onCancel,
}: {
  targetModelName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="absolute bottom-full left-0 mb-2 z-50 w-[280px] bg-popover border border-border/40 rounded-xl shadow-2xl shadow-black/12 overflow-hidden"
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lock size={11} className="text-muted-foreground/60" />
          <span className="text-xs text-foreground/85">当前模型不支持任务模式</span>
        </div>
        <p className="text-xs text-muted-foreground/65 leading-[1.6] mb-3">
          切到 <span className="text-foreground/80 font-mono">{targetModelName}</span> 以使用任务模式？
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-cherry-primary text-white text-xs hover:bg-cherry-primary-hover transition-colors active:scale-[0.97]"
          >
            <Check size={10} />
            确认并记住
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-[5px] rounded-lg text-xs text-muted-foreground/70 hover:text-foreground hover:bg-accent/25 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================
// Agent canvas view (file tree + outputs) — for the right-side panel.
// Reuses FileExplorer + ArtifactViewer verbatim.
// ===========================

export interface AgentCanvasData {
  files: FileNode[];
  outputFiles: OutputFile[];
  fileContents: Record<string, string>;
  previewHtml?: string;
  workDir?: string;
}

export function AgentCanvasView({ data, onClose }: { data: AgentCanvasData; onClose: () => void }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // Collapsed by default — showing the file list alongside the preview is too
  // cramped in the canvas width. User can toggle it open via ArtifactViewer.
  const [showExplorer, setShowExplorer] = useState(false);

  const fileContent = selectedFile && !selectedFile.startsWith('output:')
    ? data.fileContents[selectedFile] ?? null
    : null;
  const hasArtifact = !!data.previewHtml || !!fileContent;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 h-[38px] border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen size={11} className="text-cherry-primary-dark flex-shrink-0" />
          <span className="text-xs text-foreground/70 flex-shrink-0">任务产物</span>
          {data.workDir && <span className="text-xs text-muted-foreground/45 font-mono truncate">{data.workDir}</span>}
        </div>
        <Tooltip content="关闭画布" side="bottom">
          <button type="button" onClick={onClose} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/15 transition-colors flex-shrink-0">
            <X size={11} />
          </button>
        </Tooltip>
      </div>
      <div className="flex flex-1 min-h-0">
        {showExplorer && (
          <div className="w-[180px] flex-shrink-0 border-r border-border/25 min-h-0">
            <FileExplorer
              files={data.files}
              outputFiles={data.outputFiles}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <ArtifactViewer
            fileContent={fileContent}
            fileName={selectedFile && !selectedFile.startsWith('output:') ? selectedFile : null}
            previewUrl={null}
            hasArtifact={hasArtifact}
            previewHtml={data.previewHtml}
            showExplorer={showExplorer}
            onToggleExplorer={() => setShowExplorer(v => !v)}
          />
        </div>
      </div>
    </div>
  );
}
