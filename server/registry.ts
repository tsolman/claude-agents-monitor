import { randomUUID } from 'crypto';
import type { AgentTree } from './types.js';

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'idle' | 'completed' | 'error';
  metadata: Record<string, unknown>;
  registeredAt: number;
  lastHeartbeat: number;
  pid: number | null;
}

const registry = new Map<string, RegisteredAgent>();
const HEARTBEAT_TIMEOUT = 30000;

export function registerAgent(data: {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  pid?: number;
}): RegisteredAgent {
  const agent: RegisteredAgent = {
    id: randomUUID(),
    name: data.name,
    description: data.description || '',
    status: 'running',
    metadata: data.metadata || {},
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
    pid: data.pid ?? null,
  };
  registry.set(agent.id, agent);
  return agent;
}

export function updateAgent(
  id: string,
  data: { status?: RegisteredAgent['status']; metadata?: Record<string, unknown> }
): RegisteredAgent | null {
  const agent = registry.get(id);
  if (!agent) return null;

  if (data.status) agent.status = data.status;
  if (data.metadata) agent.metadata = { ...agent.metadata, ...data.metadata };
  agent.lastHeartbeat = Date.now();

  return agent;
}

export function heartbeat(id: string): boolean {
  const agent = registry.get(id);
  if (!agent) return false;
  agent.lastHeartbeat = Date.now();
  return true;
}

export function deregisterAgent(id: string): boolean {
  return registry.delete(id);
}

export function getRegisteredAgents(): RegisteredAgent[] {
  const now = Date.now();
  for (const agent of registry.values()) {
    if (now - agent.lastHeartbeat > HEARTBEAT_TIMEOUT && agent.status === 'running') {
      agent.status = 'error';
    }
  }
  return Array.from(registry.values());
}

export function registeredToAgentTree(agent: RegisteredAgent): AgentTree {
  const elapsed = formatElapsed(Date.now() - agent.registeredAt);
  return {
    pid: agent.pid || 0,
    parentPid: 0,
    cpu: 0,
    memory: 0,
    elapsed,
    command: `[API] ${agent.name}${agent.description ? ': ' + agent.description : ''}`,
    workingDirectory: null,
    type: 'main',
    children: [],
  };
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
