import type { MonitorState, AgentTree } from './types.js';

export interface HistoryEntry {
  timestamp: number;
  totalCount: number;
  totalCpu: number;
  totalMemory: number;
}

const MAX_ENTRIES = 900; // 30 min at 2s intervals
const history: HistoryEntry[] = [];

export function recordSnapshot(state: MonitorState): void {
  history.push({
    timestamp: state.timestamp,
    totalCount: state.totalCount,
    totalCpu: state.totalCpu,
    totalMemory: state.totalMemory,
  });

  if (history.length > MAX_ENTRIES) {
    history.splice(0, history.length - MAX_ENTRIES);
  }
}

export function getHistory(minutes = 30): HistoryEntry[] {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return history.filter(e => e.timestamp >= cutoff);
}

function flattenAgents(agents: AgentTree[]): AgentTree[] {
  const result: AgentTree[] = [];
  for (const agent of agents) {
    result.push(agent);
    if (agent.children.length > 0) {
      result.push(...flattenAgents(agent.children));
    }
  }
  return result;
}

export function getPerAgentHistory(
  minutes = 30
): Record<number, Array<{ timestamp: number; cpu: number; memory: number }>> {
  // Not stored per-agent in this simple implementation
  // Would need to extend recordSnapshot to store per-agent data
  return {};
}
