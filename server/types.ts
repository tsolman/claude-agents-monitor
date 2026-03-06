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
  cost?: CostInfo;
}

export interface AgentTree extends ClaudeAgent {
  children: AgentTree[];
}

export interface MonitorState {
  agents: AgentTree[];
  totalCount: number;
  mainCount: number;
  subagentCount: number;
  totalCpu: number;
  totalMemory: number;
  totalCost: number;
  timestamp: number;
  hostname: string;
  events: Array<{
    type: 'started' | 'stopped';
    pid: number;
    timestamp: number;
    workingDirectory: string | null;
  }>;
}
