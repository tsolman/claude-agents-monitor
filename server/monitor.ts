import { execSync } from 'child_process';
import os from 'os';
import type { ClaudeAgent, AgentTree, MonitorState } from './types.js';

const SELF_PID = process.pid;
const SELF_PPID = process.ppid;

export function getMonitorState(): MonitorState {
  const agents = discoverClaudeProcesses();
  const tree = buildAgentTree(agents);

  const mainCount = agents.filter(a => a.type === 'main').length;
  const subagentCount = agents.filter(a => a.type === 'subagent').length;
  const totalCpu = agents.reduce((sum, a) => sum + a.cpu, 0);
  const totalMemory = agents.reduce((sum, a) => sum + a.memory, 0);

  return {
    agents: tree,
    totalCount: agents.length,
    mainCount,
    subagentCount,
    totalCpu: Math.round(totalCpu * 10) / 10,
    totalMemory: Math.round(totalMemory * 10) / 10,
    totalCost: 0,
    timestamp: Date.now(),
    hostname: os.hostname(),
    events: [],
  };
}

function discoverClaudeProcesses(): ClaudeAgent[] {
  try {
    const output = execSync('ps -eo pid,ppid,%cpu,%mem,etime,command', {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const lines = output.trim().split('\n').slice(1);
    const parsed = lines.map(parsePsLine).filter(Boolean) as Array<
      Omit<ClaudeAgent, 'type' | 'workingDirectory'>
    >;

    const claudeProcesses = parsed.filter(isClaudeProcess);
    const claudePids = new Set(claudeProcesses.map(p => p.pid));

    return claudeProcesses.map(proc => ({
      ...proc,
      type: claudePids.has(proc.parentPid) ? ('subagent' as const) : ('main' as const),
      workingDirectory: getWorkingDirectory(proc.pid),
    }));
  } catch (error) {
    console.error('Failed to discover processes:', error);
    return [];
  }
}

function parsePsLine(
  line: string
): Omit<ClaudeAgent, 'type' | 'workingDirectory'> | null {
  const match = line
    .trim()
    .match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d:-]+)\s+(.+)$/);
  if (!match) return null;

  return {
    pid: parseInt(match[1]),
    parentPid: parseInt(match[2]),
    cpu: parseFloat(match[3]),
    memory: parseFloat(match[4]),
    elapsed: match[5],
    command: match[6],
  };
}

function isClaudeProcess(proc: { command: string; pid: number }): boolean {
  if (proc.pid === SELF_PID || proc.pid === SELF_PPID) return false;

  const cmd = proc.command;
  const lower = cmd.toLowerCase();

  if (lower.includes('claude-agents-monitor')) return false;
  if (lower.includes('grep')) return false;

  if (cmd.includes('@anthropic-ai/claude-code')) return true;
  if (cmd.includes('claude-code/')) return true;
  if (/(?:^|\s|\/)claude(?:\s|$)/.test(cmd)) return true;

  return false;
}

function getWorkingDirectory(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;

  try {
    if (process.platform === 'linux') {
      return execSync(`readlink /proc/${pid}/cwd 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
    }

    // macOS
    const output = execSync(`lsof -a -p ${pid} -d cwd -F n 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000,
    });

    for (const line of output.split('\n')) {
      if (line.startsWith('n/')) return line.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

function buildAgentTree(agents: ClaudeAgent[]): AgentTree[] {
  const pidMap = new Map<number, AgentTree>();
  const roots: AgentTree[] = [];

  for (const agent of agents) {
    pidMap.set(agent.pid, { ...agent, children: [] });
  }

  for (const agent of agents) {
    const node = pidMap.get(agent.pid)!;
    const parent = pidMap.get(agent.parentPid);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
