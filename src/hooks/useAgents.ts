import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  MonitorState,
  HistoryEntry,
  AgentEvent,
  LogEntry,
  Workflow,
  WorkflowRun,
  ProjectInfo,
} from '../types';

export function useAgents() {
  const [state, setState] = useState<MonitorState | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<AgentEvent[]>([]);
  const [agentOutputs, setAgentOutputs] = useState<Record<number, string[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Agent output streaming
        if (data.type === 'agent-output') {
          setAgentOutputs(prev => {
            const lines = [...(prev[data.pid] || []), data.line];
            if (lines.length > 500) lines.shift();
            return { ...prev, [data.pid]: lines };
          });
          return; // Don't process as regular state update
        }

        // Initial message includes full history
        if (data.history) {
          setHistory(data.history);
        }

        setState(data);

        // Accumulate history
        if (!data.history) {
          setHistory(prev => {
            const entry: HistoryEntry = {
              timestamp: data.timestamp,
              totalCount: data.totalCount,
              totalCpu: data.totalCpu,
              totalMemory: data.totalMemory,
            };
            const updated = [...prev, entry];
            const cutoff = Date.now() - 120 * 60 * 1000;
            return updated.filter(e => e.timestamp >= cutoff);
          });
        }

        // Accumulate notifications (keep last 20)
        if (data.events && data.events.length > 0) {
          setNotifications(prev => [...prev, ...data.events].slice(-20));
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const dismissNotification = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { state, connected, history, notifications, dismissNotification, agentOutputs };
}

// ─── API helpers ────────────────────────────────────────

const apiBase = '/api';

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${apiBase}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export async function stopAgent(
  pid: number,
  force?: boolean
): Promise<{ success: boolean; error?: string }> {
  const query = force ? '?force=true' : '';
  return apiFetch(`/agents/${pid}/stop${query}`, { method: 'POST' });
}

export async function startAgent(
  prompt: string,
  cwd: string
): Promise<{ success: boolean; pid?: number; error?: string }> {
  return apiFetch('/agents/start', {
    method: 'POST',
    body: JSON.stringify({ prompt, cwd }),
  });
}

export async function getAgentLogs(
  pid: number,
  cwd: string
): Promise<{ logs: LogEntry[] }> {
  return apiFetch(`/agents/${pid}/logs?cwd=${encodeURIComponent(cwd)}`);
}

export async function getAgentOutput(
  pid: number
): Promise<{ lines: string[] }> {
  return apiFetch(`/agents/${pid}/output`);
}

export async function getWorkflows(): Promise<{ workflows: Workflow[] }> {
  return apiFetch('/workflows');
}

export async function createWorkflow(
  data: Omit<Workflow, 'id' | 'createdAt'>
): Promise<Workflow> {
  return apiFetch('/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiFetch(`/workflows/${id}`, { method: 'DELETE' });
}

export async function runWorkflow(id: string): Promise<WorkflowRun> {
  return apiFetch(`/workflows/${id}/run`, { method: 'POST' });
}

export async function getWorkflowRuns(): Promise<{ runs: WorkflowRun[] }> {
  return apiFetch('/runs');
}

export async function cancelWorkflowRun(id: string): Promise<void> {
  await apiFetch(`/runs/${id}/cancel`, { method: 'POST' });
}

export async function getProjects(): Promise<{ projects: ProjectInfo[] }> {
  return apiFetch('/projects');
}

export async function getFullAgentLogs(
  pid: number,
  cwd: string,
  search?: string
): Promise<{ logs: LogEntry[] }> {
  const params = new URLSearchParams({ cwd });
  if (search) params.set('search', search);
  return apiFetch(`/agents/${pid}/full-logs?${params.toString()}`);
}

export interface ReplayMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: { input: number; output: number };
}

export async function getSessionReplay(
  projectId: string,
  sessionId: string
): Promise<{ messages: ReplayMessage[] }> {
  return apiFetch(
    `/sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/replay`
  );
}

export async function exportWorkflowJson(id: string): Promise<void> {
  const res = await fetch(`${apiBase}/workflows/${id}/export`);
  if (!res.ok) throw new Error('Export failed');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.name || 'workflow'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importWorkflowJson(file: File): Promise<Workflow> {
  const text = await file.text();
  const data = JSON.parse(text);
  return apiFetch('/workflows/import', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      description: data.description || '',
      steps: data.steps,
    }),
  });
}

// ─── Workflow templates ─────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{ name: string; prompt: string; cwd: string; dependsOn: string[] }>;
}

export async function getWorkflowTemplates(): Promise<{ templates: WorkflowTemplate[] }> {
  return apiFetch('/workflow-templates');
}

export async function createFromTemplate(
  templateId: string,
  cwd: string
): Promise<Workflow> {
  return apiFetch(`/workflow-templates/${templateId}/create`, {
    method: 'POST',
    body: JSON.stringify({ cwd }),
  });
}

// ─── Agent templates ─────────────────────────────────────

export interface AgentTemplate {
  id: string;
  name: string;
  icon?: string;
  prompt: string;
  model?: string;
  cwd?: string;
  createdAt: number;
}

export async function getAgentTemplates(): Promise<{ templates: AgentTemplate[] }> {
  return apiFetch('/agent-templates');
}

export async function createAgentTemplate(
  data: { name: string; prompt: string; icon?: string; model?: string; cwd?: string }
): Promise<AgentTemplate> {
  return apiFetch('/agent-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAgentTemplate(id: string): Promise<void> {
  await apiFetch(`/agent-templates/${id}`, { method: 'DELETE' });
}

export async function importAgentTemplate(
  opcodeConfig: Record<string, unknown>
): Promise<AgentTemplate> {
  return apiFetch('/agent-templates/import', {
    method: 'POST',
    body: JSON.stringify(opcodeConfig),
  });
}

// ─── Cost breakdown ─────────────────────────────────────

export interface ModelCostBreakdown {
  model: string;
  displayName: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  sessionCount: number;
}

export async function getCostBreakdown(): Promise<{
  models: ModelCostBreakdown[];
  totalCost: number;
  totalSessions: number;
}> {
  return apiFetch('/costs/breakdown');
}
