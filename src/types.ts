export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalCost: number;
}

export interface ClaudeAgent {
  pid: number;
  parentPid: number;
  cpu: number;
  memory: number;
  elapsed: string;
  command: string;
  workingDirectory: string | null;
  type: 'main' | 'subagent';
  children: ClaudeAgent[];
  cost?: CostInfo;
}

export interface AgentEvent {
  type: 'started' | 'stopped';
  pid: number;
  timestamp: number;
  workingDirectory: string | null;
}

export interface MonitorState {
  agents: ClaudeAgent[];
  totalCount: number;
  mainCount: number;
  subagentCount: number;
  totalCpu: number;
  totalMemory: number;
  totalCost: number;
  timestamp: number;
  hostname: string;
  events: AgentEvent[];
  history?: HistoryEntry[];
}

export interface HistoryEntry {
  timestamp: number;
  totalCount: number;
  totalCpu: number;
  totalMemory: number;
}

export interface LogEntry {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sessionId: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  dependsOn: string[];
}

export interface StepStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  pid?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  stepStatuses: Record<string, StepStatus>;
}

export interface SessionEntry {
  sessionId: string;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  totalSessions: number;
  totalMessages: number;
  lastActivity: string;
  branches: string[];
  sessions: SessionEntry[];
  hasMemory: boolean;
  diskSize: number;
}
