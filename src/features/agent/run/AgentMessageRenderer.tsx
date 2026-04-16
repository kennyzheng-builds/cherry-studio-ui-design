import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  Terminal, Loader2, Check, X,
  Bot,
  Search, Globe, Package, Code2,
  Settings, Rocket,
  Brain, Pencil, Eye, Play, Trash2, FolderOpen,
  FileCode, FileText, FileJson, File, Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { shakeAnimation } from '@/app/config/animations';
import type { AgentChatMessage } from '@/app/types/agent';
import { GenUIButtons, GenUISelection, GenUIConfirmation } from './GenerativeUI';

// Re-export for backward compatibility
export type ChatMessage = AgentChatMessage;

// ===========================
// File Mention Chip + Parser
// ===========================
// Detects filenames with known extensions inline in message text and renders them
// as clickable chips that open the file in the WorkPane. Supports:
//   - Backtick-wrapped paths: `src/App.tsx`
//   - Bare tokens with a recognized extension: report.md
// Non-file backticks and code are rendered as inline code, preserving existing formatting.

const FILE_EXT_GROUP =
  'md|txt|tsx?|jsx?|json|ya?ml|css|scss|html?|py|go|rs|java|kt|swift|rb|php|sh|toml|ini|env|svg|png|jpe?g|gif|ico|pdf|docx?|pptx?|xlsx?|csv';

// One unified regex so we iterate the string in order and alternate text/chip.
// Group 1: backticked segment (full body captured in group 2)
// Group 3: bare file token
const MENTION_RE = new RegExp(
  '`([^`\\n]+)`|(\\b[\\w./-]+\\.(?:' + FILE_EXT_GROUP + ')\\b)',
  'gi'
);

function chipIconFor(name: string, size = 9) {
  const cls = 'flex-shrink-0';
  if (name.endsWith('.json')) return <FileJson size={size} className={cls} />;
  if (/\.(tsx?|jsx?|css|scss|html?|py|go|rs|java|kt|swift|rb|php|sh)$/i.test(name))
    return <FileCode size={size} className={cls} />;
  if (/\.(svg|png|jpe?g|gif|ico)$/i.test(name)) return <ImageIcon size={size} className={cls} />;
  if (/\.(md|txt|pdf|docx?|pptx?|xlsx?|csv|ya?ml|toml|ini|env)$/i.test(name))
    return <FileText size={size} className={cls} />;
  return <File size={size} className={cls} />;
}

function FileMentionChip({ path, onClick }: { path: string; onClick: () => void }) {
  const name = path.split('/').pop() || path;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-baseline gap-1 px-1.5 py-[1px] mx-[1px] rounded-[4px] bg-cherry-active-bg/50 hover:bg-cherry-active-bg text-cherry-primary-dark hover:text-cherry-primary text-[10px] font-mono align-baseline transition-colors cursor-pointer"
      title={path}
    >
      <span className="translate-y-[1px]">{chipIconFor(name)}</span>
      <span>{name}</span>
    </button>
  );
}

function looksLikeFile(token: string): boolean {
  // Must contain a dot-extension, no whitespace, reasonable length
  if (!token || token.length > 120) return false;
  if (/\s/.test(token)) return false;
  return /\.[a-z0-9]+$/i.test(token);
}

/**
 * Split message text into plain text and clickable file-mention chips.
 * If no onOpenFile handler provided, returns the original string verbatim.
 */
function renderWithMentions(text: string, onOpenFile?: (key: string) => void): React.ReactNode {
  if (!text) return text;
  if (!onOpenFile) return text;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;

  while ((m = MENTION_RE.exec(text)) !== null) {
    const [full, backtickBody, bareToken] = m;
    const candidate = (backtickBody ?? bareToken ?? '').trim();
    if (!looksLikeFile(candidate)) continue;

    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <FileMentionChip key={`fm-${key++}`} path={candidate} onClick={() => onOpenFile(candidate)} />
    );
    last = m.index + full.length;
  }

  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ===========================
// Collapsible Message Row (task-style)
// ===========================

function CollapsibleRow({ icon, label, statusIndicator, children, defaultOpen = false }: {
  icon: React.ReactNode;
  label: string;
  statusIndicator?: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex items-center gap-2 w-full text-left py-[5px] px-1 rounded-md text-[10.5px] transition-colors ${
          hasChildren ? 'hover:bg-accent/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        {icon}
        <span className="text-foreground/75 flex-1 truncate">{label}</span>
        {statusIndicator}
        {hasChildren && (
          <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.1 }}>
            <ChevronRight size={9} className="text-muted-foreground/50" />
          </motion.div>
        )}
      </button>
      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="overflow-hidden"
            >
              <div className="ml-6 pl-2.5 border-l border-border/25 pb-1 pt-0.5">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ===========================
// Semantic Icon resolver for messages
// ===========================

function resolveToolIcon(name: string, size = 11): React.ReactNode {
  const n = name.toLowerCase();
  if (n.includes('search') || n.includes('find') || n.includes('analyz'))
    return <Search size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('web') || n.includes('browse') || n.includes('http') || n.includes('fetch'))
    return <Globe size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('write') || n.includes('edit') || n.includes('update') || n.includes('create') || n.includes('modify'))
    return <Pencil size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('install') || n.includes('npm') || n.includes('pnpm') || n.includes('yarn') || n.includes('package'))
    return <Package size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('config') || n.includes('init') || n.includes('setup') || n.includes('setting'))
    return <Settings size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('run') || n.includes('exec') || n.includes('start') || n.includes('dev') || n.includes('vite') || n.includes('npx'))
    return <Play size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('delete') || n.includes('remove') || n.includes('clean'))
    return <Trash2 size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('read') || n.includes('view') || n.includes('inspect') || n.includes('check') || n.includes('review'))
    return <Eye size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('build') || n.includes('compile') || n.includes('deploy'))
    return <Rocket size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('folder') || n.includes('dir') || n.includes('mkdir'))
    return <FolderOpen size={size} className="text-muted-foreground flex-shrink-0" />;
  if (n.includes('code') || n.includes('component') || n.includes('function'))
    return <Code2 size={size} className="text-muted-foreground flex-shrink-0" />;
  return <Terminal size={size} className="text-muted-foreground flex-shrink-0" />;
}

// ===========================
// User Message
// ===========================

export function UserMessage({ msg, onOpenFile }: { msg: ChatMessage; onOpenFile?: (key: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-[14px] rounded-br-[4px] bg-foreground text-background text-[11px] leading-[1.65]">
        {renderWithMentions(msg.content ?? '', onOpenFile)}
      </div>
    </motion.div>
  );
}

// ===========================
// Agent Message Group
// ===========================

export function AgentMessageGroup({ msgs, onResolve, onAvatarClick, onOpenFile }: {
  msgs: ChatMessage[];
  onResolve: (msgId: string, value: string) => void;
  onAvatarClick?: () => void;
  onOpenFile?: (key: string) => void;
}) {
  return (
    <div className="flex gap-2 max-w-[95%]">
      <button
        onClick={onAvatarClick}
        className="w-5 h-5 rounded-[5px] bg-accent/40 flex items-center justify-center flex-shrink-0 mt-[1px] hover:bg-accent/70 transition-colors cursor-pointer active:scale-[0.92]"
      >
        <Bot size={10} className="text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {msgs.map((msg) => (
          <div key={msg.id}>
            {msg.thinking && (
              <CollapsibleRow
                icon={
                  <motion.div {...shakeAnimation} className="flex items-center justify-center flex-shrink-0">
                    <Brain size={11} className="text-purple-500" />
                  </motion.div>
                }
                label="思考中..."
              >
                <p className="text-[10px] text-muted-foreground/70 leading-[1.7]">
                  {renderWithMentions(msg.thinking, onOpenFile)}
                </p>
              </CollapsibleRow>
            )}

            {msg.toolCall && (
              <CollapsibleRow
                icon={
                  msg.toolCall.status === 'running' ? (
                    <motion.div {...shakeAnimation} className="flex items-center justify-center flex-shrink-0">
                      {resolveToolIcon(msg.toolCall.name)}
                    </motion.div>
                  ) : resolveToolIcon(msg.toolCall.name)
                }
                label={msg.toolCall.name}
                statusIndicator={
                  msg.toolCall.status === 'running' ? (
                    <Loader2 size={9} className="text-cherry-primary animate-spin flex-shrink-0" />
                  ) : msg.toolCall.status === 'done' ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {msg.toolCall.duration && <span className="text-[9px] text-muted-foreground/55 tabular-nums">{msg.toolCall.duration}</span>}
                      <Check size={9} className="text-cherry-primary-dark" />
                    </div>
                  ) : msg.toolCall.status === 'error' ? (
                    <X size={9} className="text-red-500 flex-shrink-0" />
                  ) : undefined
                }
              />
            )}

            {msg.content && (
              <motion.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[11px] text-foreground/90 leading-[1.7] py-1 px-1"
              >
                {renderWithMentions(msg.content, onOpenFile)}
              </motion.div>
            )}

            {msg.generativeUI && (
              <div className="py-0.5">
                {msg.generativeUI.type === 'buttons' && <GenUIButtons data={msg.generativeUI} msgId={msg.id} onResolve={onResolve} />}
                {msg.generativeUI.type === 'selection' && <GenUISelection data={msg.generativeUI} msgId={msg.id} onResolve={onResolve} />}
                {msg.generativeUI.type === 'confirmation' && <GenUIConfirmation data={msg.generativeUI} msgId={msg.id} onResolve={onResolve} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================
// Message grouping utility
// ===========================

export function useGroupedMessages(messages: ChatMessage[]) {
  return useMemo(() => {
    const groups: Array<{ type: 'user'; msg: ChatMessage } | { type: 'agent'; msgs: ChatMessage[] }> = [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        groups.push({ type: 'user', msg });
      } else {
        const last = groups[groups.length - 1];
        if (last && last.type === 'agent') {
          last.msgs.push(msg);
        } else {
          groups.push({ type: 'agent', msgs: [msg] });
        }
      }
    }
    return groups;
  }, [messages]);
}
