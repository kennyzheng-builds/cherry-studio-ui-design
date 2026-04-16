import React, { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FileJson, FileCode, FileText, Image as ImageIcon, Settings,
  FileSpreadsheet, Presentation, FileType, Upload, Download, FolderTree,
  Search as SearchIcon, X, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FileNode, OutputFile } from '@/app/types/agent';

// ===========================
// File Index Panel
// ===========================
// Inline expandable left column inside the WorkPane (Cursor-style).
// Toggled by the 📁 button in the WorkPane header — persists open until toggled off.
// Shows files organized by user intent (imported vs produced) rather than tech classification.

interface Props {
  files: FileNode[];
  outputFiles: OutputFile[];
  importedFiles?: Array<{ path: string; name: string }>;
  openedFiles: Set<string>;
  activeFile: string | null;
  onOpenFile: (key: string) => void;
}

function getFileIcon(name: string, size = 11) {
  const cls = 'text-muted-foreground flex-shrink-0';
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

function getOutputIcon(format: string, size = 12) {
  const cls = 'flex-shrink-0';
  switch (format) {
    case 'docx': case 'doc': return <FileType size={size} className={`text-blue-500 ${cls}`} />;
    case 'pptx': case 'ppt': return <Presentation size={size} className={`text-orange-500 ${cls}`} />;
    case 'xlsx': case 'xls': case 'csv': return <FileSpreadsheet size={size} className={`text-cyan-500 ${cls}`} />;
    case 'pdf': return <FileText size={size} className={`text-red-500 ${cls}`} />;
    case 'md': return <FileText size={size} className={`text-muted-foreground ${cls}`} />;
    default: return <File size={size} className={`text-muted-foreground ${cls}`} />;
  }
}

// Flatten tree to searchable list
function flattenTree(nodes: FileNode[], basePath = ''): Array<{ path: string; name: string }> {
  const result: Array<{ path: string; name: string }> = [];
  for (const node of nodes) {
    const path = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ path, name: node.name });
    } else if (node.children) {
      result.push(...flattenTree(node.children, path));
    }
  }
  return result;
}

// ===========================
// Tree Node (compact)
// ===========================

function TreeNode({
  node, depth, path, activeFile, openedFiles, onOpenFile, defaultOpen,
}: {
  node: FileNode;
  depth: number;
  path: string;
  activeFile: string | null;
  openedFiles: Set<string>;
  onOpenFile: (key: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 1);
  const fullPath = path ? `${path}/${node.name}` : node.name;
  const isActive = activeFile === fullPath;
  const isOpened = openedFiles.has(fullPath);
  const indent = 8 + depth * 12;

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-[5px] w-full py-[3px] rounded text-[10px] transition-all duration-75 text-foreground/70 hover:bg-accent/20 hover:text-foreground"
          style={{ paddingLeft: indent, paddingRight: 4 }}
        >
          <span className="flex-shrink-0 w-2.5 flex items-center justify-center">
            {open
              ? <ChevronDown size={8} className="text-muted-foreground" />
              : <ChevronRight size={8} className="text-muted-foreground" />}
          </span>
          {open
            ? <FolderOpen size={11} className="text-muted-foreground flex-shrink-0" />
            : <Folder size={11} className="text-muted-foreground flex-shrink-0" />}
          <span className="truncate flex-1 text-left">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {open && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="overflow-hidden"
            >
              {node.children.map((child, i) => (
                <TreeNode
                  key={`${child.name}-${i}`}
                  node={child}
                  depth={depth + 1}
                  path={fullPath}
                  activeFile={activeFile}
                  openedFiles={openedFiles}
                  onOpenFile={onOpenFile}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      onClick={() => onOpenFile(fullPath)}
      className={`flex items-center gap-[5px] w-full py-[3px] rounded text-[10px] transition-all duration-75
        ${isActive
          ? 'bg-cherry-active-bg text-cherry-text'
          : isOpened
            ? 'bg-accent/15 text-foreground/80 hover:bg-accent/25'
            : 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'}`}
      style={{ paddingLeft: indent + 14, paddingRight: 4 }}
    >
      {getFileIcon(node.name)}
      <span className="truncate flex-1 text-left">{node.name}</span>
      {isOpened && !isActive && (
        <span className="w-1 h-1 rounded-full bg-cherry-primary/60 flex-shrink-0" />
      )}
    </button>
  );
}

// ===========================
// Section Header
// ===========================

function SectionHeader({
  icon, label, expanded, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] text-foreground/75 hover:bg-accent/15 rounded transition-colors"
    >
      <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.12 }}>
        <ChevronRight size={9} className="text-muted-foreground/60" />
      </motion.div>
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

// ===========================
// File Index Panel
// ===========================

export function FileIndexPanel({
  files,
  outputFiles,
  importedFiles = [],
  openedFiles,
  activeFile,
  onOpenFile,
}: Props) {
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(true);
  const [outputOpen, setOutputOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Flatten tree for search
  const allFlatFiles = useMemo(() => flattenTree(files), [files]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return {
      imports: importedFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)),
      outputs: outputFiles.filter(f => f.name.toLowerCase().includes(q)),
      workspace: allFlatFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)),
    };
  }, [search, importedFiles, outputFiles, allFlatFiles]);

  // Column stays open after opening a file — user toggles close via 📁 button
  const handleOpen = (key: string) => {
    onOpenFile(key);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-1.5 pt-2 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-accent/15 border border-border/20">
          <SearchIcon size={10} className="text-muted-foreground/40 flex-shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索文件..."
            className="flex-1 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/30 outline-none min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground/30 hover:text-muted-foreground/60">
              <X size={8} />
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-border/20 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1.5 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-border/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        {searchResults ? (
          // ===== Search mode: flat results =====
          <div className="px-1">
            {searchResults.imports.length === 0 && searchResults.outputs.length === 0 && searchResults.workspace.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <SearchIcon size={14} className="text-muted-foreground/20 mb-1.5" />
                <span className="text-[10px] text-muted-foreground/40">无匹配结果</span>
              </div>
            ) : (
              <>
                {searchResults.imports.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] text-muted-foreground/45 px-2 mb-0.5">导入</div>
                    {searchResults.imports.map(f => (
                      <button
                        key={f.path}
                        onClick={() => handleOpen(f.path)}
                        className="flex items-center gap-[5px] w-full px-2 py-[4px] rounded text-[10px] text-foreground/75 hover:bg-accent/20 hover:text-foreground transition-colors"
                      >
                        {getFileIcon(f.name)}
                        <span className="truncate flex-1 text-left">{f.name}</span>
                        <span className="text-[8.5px] text-muted-foreground/35 truncate max-w-[140px]">{f.path}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.outputs.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] text-muted-foreground/45 px-2 mb-0.5">产出</div>
                    {searchResults.outputs.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleOpen(`output:${f.id}`)}
                        className="flex items-center gap-[5px] w-full px-2 py-[4px] rounded text-[10px] text-foreground/75 hover:bg-accent/20 hover:text-foreground transition-colors"
                      >
                        {getOutputIcon(f.format)}
                        <span className="truncate flex-1 text-left">{f.name}</span>
                        <span className="text-[8.5px] text-muted-foreground/35 uppercase flex-shrink-0">{f.format}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.workspace.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] text-muted-foreground/45 px-2 mb-0.5">工作目录</div>
                    {searchResults.workspace.map(f => (
                      <button
                        key={f.path}
                        onClick={() => handleOpen(f.path)}
                        className="flex items-center gap-[5px] w-full px-2 py-[4px] rounded text-[10px] text-foreground/75 hover:bg-accent/20 hover:text-foreground transition-colors"
                      >
                        {getFileIcon(f.name)}
                        <span className="truncate flex-1 text-left">{f.name}</span>
                        <span className="text-[8.5px] text-muted-foreground/35 truncate max-w-[140px]">{f.path}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          // ===== Normal mode: sections =====
          <>
            {/* 📥 本次会话导入 */}
            <div className="px-1 mb-1">
              <SectionHeader
                icon={<Upload size={10} className="text-sky-500/70" />}
                label="本次会话导入"
                expanded={importOpen}
                onToggle={() => setImportOpen(!importOpen)}
              />
              <AnimatePresence initial={false}>
                {importOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden"
                  >
                    {importedFiles.length === 0 ? (
                      <div className="px-7 py-1.5 text-[9px] text-muted-foreground/40 italic">
                        拖拽文件到对话框即可导入
                      </div>
                    ) : (
                      importedFiles.map(f => {
                        const isOpened = openedFiles.has(f.path);
                        const isActive = activeFile === f.path;
                        return (
                          <button
                            key={f.path}
                            onClick={() => handleOpen(f.path)}
                            className={`flex items-center gap-[5px] w-full py-[3px] rounded text-[10px] transition-all duration-75
                              ${isActive
                                ? 'bg-cherry-active-bg text-cherry-text'
                                : isOpened
                                  ? 'bg-accent/15 text-foreground/80 hover:bg-accent/25'
                                  : 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'}`}
                            style={{ paddingLeft: 22, paddingRight: 4 }}
                          >
                            {getFileIcon(f.name)}
                            <span className="truncate flex-1 text-left">{f.name}</span>
                          </button>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 📤 本次会话产出 */}
            <div className="px-1 mb-1">
              <SectionHeader
                icon={<Download size={10} className="text-cherry-primary" />}
                label="本次会话产出"
                expanded={outputOpen}
                onToggle={() => setOutputOpen(!outputOpen)}
              />
              <AnimatePresence initial={false}>
                {outputOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden"
                  >
                    {outputFiles.length === 0 ? (
                      <div className="px-7 py-1.5 text-[9px] text-muted-foreground/40 italic">
                        暂无产出
                      </div>
                    ) : (
                      outputFiles.map(f => {
                        const key = `output:${f.id}`;
                        const isOpened = openedFiles.has(key);
                        const isActive = activeFile === key;
                        const isGenerating = f.status === 'generating';
                        return (
                          <button
                            key={f.id}
                            onClick={() => handleOpen(key)}
                            className={`flex items-center gap-[5px] w-full py-[4px] rounded text-[10px] transition-all duration-75
                              ${isActive
                                ? 'bg-cherry-active-bg text-cherry-text'
                                : isOpened
                                  ? 'bg-accent/15 text-foreground/80 hover:bg-accent/25'
                                  : 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'}`}
                            style={{ paddingLeft: 22, paddingRight: 4 }}
                          >
                            {getOutputIcon(f.format)}
                            <span className="truncate flex-1 text-left">{f.name}</span>
                            {isGenerating && (
                              <Loader2 size={9} className="text-amber-500 animate-spin flex-shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 📁 完整工作目录 */}
            <div className="px-1">
              <SectionHeader
                icon={<FolderTree size={10} className="text-muted-foreground/70" />}
                label="完整工作目录"
                expanded={workspaceOpen}
                onToggle={() => setWorkspaceOpen(!workspaceOpen)}
              />
              <AnimatePresence initial={false}>
                {workspaceOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden pt-0.5"
                  >
                    {files.length === 0 ? (
                      <div className="px-7 py-1.5 text-[9px] text-muted-foreground/40 italic">
                        工作目录为空
                      </div>
                    ) : (
                      files.map((node, i) => (
                        <TreeNode
                          key={`${node.name}-${i}`}
                          node={node}
                          depth={0}
                          path=""
                          activeFile={activeFile}
                          openedFiles={openedFiles}
                          onOpenFile={handleOpen}
                          defaultOpen
                        />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
