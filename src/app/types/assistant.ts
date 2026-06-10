// ===========================
// Assistant-Specific Types
// ===========================
// Types used by the Assistant run page and related components.
// Extracted from assistant/mockData.ts.

// --- Assistant Info ---
export interface AssistantInfo {
  id: string;
  name: string;
  model: string;
  modelProvider: string;
  updatedAt: string;
  tags: string[];
  systemPrompt: string;
  knowledgeBases: { id: string; name: string }[];
  tools: { id: string; name: string; icon?: string }[];
  /** Chat/Agent 融合 (V1): drives the conversation's starting mode + the
   *  name-trailing icon in the unified list. Defaults to 'chat'. */
  defaultMode?: 'chat' | 'agent';
  /** Chat/Agent 融合 (V1): where this assistant runs — 本地 or 云端(Stella).
   *  Set per-assistant in settings; used to group/filter the topic list.
   *  Defaults to 'local'. */
  runtime?: 'local' | 'cloud';
}

// --- Branch Tree Types ---
export interface BranchNode {
  id: string;
  role: 'user' | 'assistant' | 'parallel';
  label: string;
  preview: string;
  children: BranchNode[];
  branchId: string;
  model?: string;
  assistantName?: string;
  parallelCount?: number;
}

export interface LayoutNode {
  node: BranchNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  collapsed: boolean;
  isActive: boolean;
}

// --- Assistant Topic ---
export interface AssistantTopic {
  id: string;
  title: string;
  assistantName: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
  status: 'active' | 'completed';
  pinned?: boolean;
  tags?: string[];
  group?: string;
  /** Chat/Agent 融合 (V1): runtime of this conversation, derived from its
   *  assistant — used by the「运行环境」grouping in the topic list. */
  runtime?: 'local' | 'cloud';
}
