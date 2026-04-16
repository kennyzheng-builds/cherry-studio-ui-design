import React, { useState, useMemo } from 'react';
import {
  Monitor, Code2, Eye, X,
  Maximize2, Minimize2, List,
  FileCode, FileJson, FileText, File, Image as ImageIcon,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from '@/app/components/Tooltip';
import { FileIndexPanel } from './FileIndexPanel';
import type { FileNode, OutputFile } from '@/app/types/agent';

// ===========================
// Types
// ===========================

interface Props {
  // Multi-file tab state
  openedFiles: string[];
  activeFile: string | null;
  onSelectFile: (key: string) => void;
  onCloseFile: (key: string) => void;
  onOpenFile: (key: string) => void;

  // Content resolution
  fileContent: string | null;
  getFileLabel: (key: string) => string;

  // File index popover data
  allFiles: FileNode[];
  outputFiles: OutputFile[];
  importedFiles?: Array<{ path: string; name: string }>;

  // Session-level preview (iframe)
  previewUrl: string | null;
  previewHtml?: string;
  hasArtifact: boolean;

  // Panel actions
  onClosePanel?: () => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

type ViewMode = 'preview' | 'code';

// ===========================
// File Icon Resolver
// ===========================

function getFileIcon(key: string, size = 10) {
  if (key.startsWith('output:')) {
    // Use a generic icon for output files in tab
    return <FileText size={size} className="text-cherry-primary/70 flex-shrink-0" />;
  }
  const name = key.split('/').pop() || key;
  const cls = 'text-muted-foreground/70 flex-shrink-0';
  if (name.endsWith('.json')) return <FileJson size={size} className={cls} />;
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode size={size} className={cls} />;
  if (name.endsWith('.jsx') || name.endsWith('.js')) return <FileCode size={size} className={cls} />;
  if (name.endsWith('.css') || name.endsWith('.scss')) return <FileCode size={size} className={cls} />;
  if (name.endsWith('.html')) return <FileCode size={size} className={cls} />;
  if (name.endsWith('.md')) return <FileText size={size} className={cls} />;
  if (name.endsWith('.svg') || name.endsWith('.png') || name.endsWith('.ico')) return <ImageIcon size={size} className={cls} />;
  if (name === '.gitignore' || name === '.env') return <Settings size={size} className={cls} />;
  return <File size={size} className={cls} />;
}

// ===========================
// Syntax Highlighter (Light theme)
// ===========================

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var',
  'function', 'return', 'if', 'else', 'for', 'while', 'class',
  'extends', 'new', 'this', 'typeof', 'interface', 'type', 'as',
  'async', 'await', 'try', 'catch', 'throw', 'switch', 'case',
  'break', 'continue', 'do', 'in', 'of', 'yield', 'void',
]);

const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

const BT = String.fromCharCode(96);
const TOKEN_PATTERN = new RegExp(
  '(' +
  '\\/\\/.*' +
  '|' + String.fromCharCode(39) + '[^' + String.fromCharCode(39) + ']*' + String.fromCharCode(39) +
  '|"[^"]*"' +
  '|' + BT + '[^' + BT + ']*' + BT +
  '|\\b\\d+(?:\\.\\d+)?\\b' +
  '|[a-zA-Z_$][a-zA-Z0-9_$]*' +
  '|[{}()\\[\\];,.:=<>+\\-*/!&|?@#~^%]+' +
  '|\\s+' +
  ')',
  'g'
);

const RE_LINE_COMMENT = new RegExp('^\\/' + String.fromCharCode(47));
const RE_STRING_START = new RegExp('^[' + String.fromCharCode(39) + '"' + BT + ']');
const RE_DIGIT_START = new RegExp('^\\d');
const RE_UPPER_START = new RegExp('^[A-Z]');
const RE_PUNCTUATION = new RegExp('^[{}()\\[\\];,.:=<>+\\-*/!&|?@#~^%]+$');

function tokenizeLine(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let match;
  let key = 0;

  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    const seg = match[0];
    if (RE_LINE_COMMENT.test(seg)) {
      tokens.push(<span key={key++} className="text-[#6a737d]">{seg}</span>);
    } else if (RE_STRING_START.test(seg)) {
      tokens.push(<span key={key++} className="text-[#b07d48]">{seg}</span>);
    } else if (RE_DIGIT_START.test(seg)) {
      tokens.push(<span key={key++} className="text-[#0e7490]">{seg}</span>);
    } else if (KEYWORDS.has(seg)) {
      tokens.push(<span key={key++} className="text-[#8250df]">{seg}</span>);
    } else if (LITERALS.has(seg)) {
      tokens.push(<span key={key++} className="text-[#0e7490]">{seg}</span>);
    } else if (RE_UPPER_START.test(seg) && seg.length > 1) {
      tokens.push(<span key={key++} className="text-[#1a7f37]">{seg}</span>);
    } else if (RE_PUNCTUATION.test(seg)) {
      tokens.push(<span key={key++} className="text-foreground/55">{seg}</span>);
    } else {
      tokens.push(<span key={key++} className="text-foreground/85">{seg}</span>);
    }
  }

  return tokens;
}

function CodeBlock({ code }: { code: string }) {
  const lines = useMemo(() => code.split('\n'), [code]);
  const gutterWidth = String(lines.length).length * 8 + 24;

  return (
    <div className="font-mono text-[11px] leading-[20px]">
      {lines.map((line, i) => (
        <div key={i} className="flex hover:bg-accent/12">
          <span
            className="text-right pr-5 text-muted-foreground/40 select-none flex-shrink-0 tabular-nums"
            style={{ width: gutterWidth, minWidth: gutterWidth }}
          >
            {i + 1}
          </span>
          <span className="flex-1 pr-4 text-foreground/85">{tokenizeLine(line)}</span>
        </div>
      ))}
    </div>
  );
}

// ===========================
// Empty State
// ===========================

function EmptyState({ onBrowseFiles }: { onBrowseFiles?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full px-8"
    >
      <div className="w-16 h-16 rounded-2xl bg-accent/25 flex items-center justify-center mb-4">
        <Monitor size={24} strokeWidth={1.2} className="text-muted-foreground/30" />
      </div>
      <p className="text-[12px] text-muted-foreground mb-1">{"准备就绪"}</p>
      <p className="text-[10px] text-muted-foreground/55 max-w-[260px] text-center leading-[1.6]">
        {"点击聊天中的文件或产出物查看预览，也可以从左上角浏览全部文件。"}
      </p>
      {onBrowseFiles && (
        <button
          onClick={onBrowseFiles}
          className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] text-foreground/70 hover:text-foreground bg-accent/20 hover:bg-accent/30 transition-colors"
        >
          <FolderSearch size={10} />
          浏览文件
        </button>
      )}
    </motion.div>
  );
}

// ===========================
// File Tab
// ===========================

function FileTab({
  fileKey, label, isActive, onSelect, onClose,
}: {
  fileKey: string;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-1.5 pl-2 pr-1 py-[4px] rounded-md text-[10px] cursor-pointer transition-all duration-75 max-w-[160px] flex-shrink-0 ${
        isActive
          ? 'bg-background text-foreground shadow-sm shadow-black/5'
          : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/15'
      }`}
    >
      {getFileIcon(fileKey)}
      <span className="truncate flex-1 min-w-0">{label}</span>
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className={`p-[1px] rounded transition-all flex-shrink-0 ${
          isActive
            ? 'text-muted-foreground/55 hover:text-foreground hover:bg-accent/30'
            : 'opacity-0 group-hover:opacity-100 text-muted-foreground/55 hover:text-foreground hover:bg-accent/30'
        }`}
      >
        <X size={9} />
      </button>
    </div>
  );
}

// ===========================
// Artifact Viewer
// ===========================

export function ArtifactViewer({
  openedFiles, activeFile, onSelectFile, onCloseFile, onOpenFile,
  fileContent, getFileLabel,
  allFiles, outputFiles, importedFiles,
  previewUrl: _previewUrl, previewHtml, hasArtifact,
  onClosePanel, maximized, onToggleMaximize,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [fileColOpen, setFileColOpen] = useState(false);

  const openedSet = useMemo(() => new Set(openedFiles), [openedFiles]);
  const showContentArea = hasArtifact || !!activeFile;

  return (
    <div className="flex flex-col h-full">
      {/* ===== Top Bar: File Index Toggle + File Tabs + Controls ===== */}
      <div className="flex items-stretch px-1.5 flex-shrink-0 h-[36px] gap-0.5">
        {/* Inline file column toggle (Cursor-style: Browse Files) */}
        <Tooltip content={fileColOpen ? '收起文件列表' : '浏览文件'} side="bottom">
          <button
            onClick={() => setFileColOpen(v => !v)}
            className={`flex items-center justify-center px-1.5 rounded transition-colors flex-shrink-0 ${
              fileColOpen
                ? 'text-foreground bg-accent/30'
                : 'text-muted-foreground hover:text-foreground/80 hover:bg-accent/15'
            }`}
          >
            <List size={12} />
          </button>
        </Tooltip>

        <div className="w-px my-2 bg-border/25 flex-shrink-0" />

        {/* File tabs (scrollable if overflow) */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto bg-accent/20 rounded-lg p-[3px] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/25 [&::-webkit-scrollbar-thumb]:rounded-full">
          {openedFiles.length === 0 ? (
            <span className="text-[10px] text-muted-foreground/40 px-2 py-1">
              暂无打开的文件
            </span>
          ) : (
            openedFiles.map(key => (
              <FileTab
                key={key}
                fileKey={key}
                label={getFileLabel(key)}
                isActive={activeFile === key}
                onSelect={() => onSelectFile(key)}
                onClose={() => onCloseFile(key)}
              />
            ))
          )}
        </div>

        <div className="w-px my-2 bg-border/25 flex-shrink-0" />

        {/* Right controls — icon-only view toggle + maximize + close */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Preview / Code icon toggle */}
          {showContentArea && (
            <div className="inline-flex items-center bg-accent/15 rounded-md p-[2px] mr-0.5">
              <Tooltip content="预览" side="bottom">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center justify-center w-[22px] h-[20px] rounded transition-all duration-150 ${
                    viewMode === 'preview'
                      ? 'bg-background text-foreground shadow-sm shadow-black/5'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                  }`}
                >
                  <Eye size={11} />
                </button>
              </Tooltip>
              <Tooltip content="源码" side="bottom">
                <button
                  onClick={() => setViewMode('code')}
                  className={`flex items-center justify-center w-[22px] h-[20px] rounded transition-all duration-150 ${
                    viewMode === 'code'
                      ? 'bg-background text-foreground shadow-sm shadow-black/5'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                  }`}
                >
                  <Code2 size={11} />
                </button>
              </Tooltip>
            </div>
          )}

          {onToggleMaximize && (
            <Tooltip content={maximized ? '退出最大化' : '最大化'} side="bottom">
              <button onClick={onToggleMaximize}
                className={`p-1 rounded transition-colors ${maximized ? 'text-foreground/80 bg-accent/25' : 'text-muted-foreground hover:text-foreground/70'}`}>
                {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </Tooltip>
          )}

          {onClosePanel && (
            <Tooltip content="关闭面板" side="bottom">
              <button onClick={onClosePanel}
                className="p-1 rounded text-muted-foreground hover:text-foreground/70 hover:bg-accent/15 transition-colors">
                <X size={11} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ===== Body: Optional File Column + Content Area ===== */}
      <div className="flex flex-1 min-h-0">
        {/* Inline file column (Cursor-style) — animates open/closed */}
        <AnimatePresence initial={false}>
          {fileColOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 168, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="flex-shrink-0 border-r border-border/25 overflow-hidden"
            >
              <div style={{ width: 168 }} className="h-full">
                <FileIndexPanel
                  files={allFiles}
                  outputFiles={outputFiles}
                  importedFiles={importedFiles}
                  openedFiles={openedSet}
                  activeFile={activeFile}
                  onOpenFile={onOpenFile}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content area (preview or code) */}
        <div className="flex-1 min-h-0 min-w-0 relative">
        {!showContentArea ? (
          <EmptyState onBrowseFiles={() => setFileColOpen(true)} />
        ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'preview' ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full flex items-start justify-center bg-accent/8 overflow-auto p-0"
            >
              {previewHtml ? (
                <div className="h-full w-full flex justify-center">
                  <div className="bg-white h-full overflow-hidden w-full">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-full border-0"
                      title="预览"
                      sandbox="allow-scripts"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Monitor size={20} strokeWidth={1.2} className="text-muted-foreground/30" />
                  <p className="text-[10px] text-muted-foreground/50">{"暂无预览"}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              <div className="h-full overflow-auto bg-background py-3 pl-2 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/25 [&::-webkit-scrollbar-thumb]:rounded-full">
                {fileContent ? (
                  <CodeBlock code={fileContent} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Code2 size={20} strokeWidth={1.2} className="text-muted-foreground/30" />
                    <p className="text-[10px] text-muted-foreground/50">{"选择文件以查看代码"}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
        </div>
      </div>
    </div>
  );
}
