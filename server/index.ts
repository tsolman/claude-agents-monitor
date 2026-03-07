import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { getMonitorState } from './monitor.js';
import { stopAgent, startAgent } from './control.js';
import { recordSnapshot, getHistory } from './history.js';
import { trackLifecycle, getEvents } from './notifications.js';
import { getSessionLogs, getFullSessionLogs, getProjectSessions } from './logs.js';
import { getAgentCost, getCostBreakdownByModel } from './costs.js';
import {
  getRegisteredAgents,
  registerAgent,
  updateAgent,
  deregisterAgent,
  heartbeat,
  registeredToAgentTree,
} from './registry.js';
import {
  createWorkflow,
  getWorkflows,
  getWorkflow,
  deleteWorkflow,
  startWorkflowRun,
  getRuns,
  getRun,
  cancelRun,
  exportWorkflow,
  importWorkflow,
  getWorkflowTemplates,
  createWorkflowFromTemplate,
} from './workflows.js';
import { getAllProjects } from './projects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3100');
const POLL_INTERVAL = 2000;

const app = express();
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Serve built frontend assets
app.use(express.static(path.join(__dirname, '../dist')));

// ─── Agent monitoring ───────────────────────────────────

function getFullState() {
  const state = getMonitorState();

  // Merge registered API agents into the tree
  const apiAgents = getRegisteredAgents()
    .filter(a => a.status === 'running' || a.status === 'idle')
    .map(registeredToAgentTree);
  state.agents.push(...apiAgents);
  state.totalCount += apiAgents.length;
  state.mainCount += apiAgents.length;

  // Enrich agents with cost data
  enrichAgentsWithCost(state.agents);
  const allFlat = flattenAgentsForCost(state.agents);
  state.totalCost = Math.round(
    allFlat.reduce((sum, a) => sum + (a.cost?.totalCost || 0), 0) * 10000
  ) / 10000;

  // Track lifecycle events
  const allAgents = flattenAgents(state.agents);
  const newEvents = trackLifecycle(allAgents);
  state.events = newEvents;

  // Record history snapshot
  recordSnapshot(state);

  return state;
}

function flattenAgents(
  agents: Array<{ pid: number; workingDirectory: string | null; children?: unknown[] }>
): Array<{ pid: number; workingDirectory: string | null }> {
  const result: Array<{ pid: number; workingDirectory: string | null }> = [];
  for (const agent of agents) {
    result.push({ pid: agent.pid, workingDirectory: agent.workingDirectory });
    if (Array.isArray((agent as { children?: unknown[] }).children)) {
      result.push(
        ...flattenAgents(
          (agent as { children: typeof agents }).children
        )
      );
    }
  }
  return result;
}

function enrichAgentsWithCost(
  agents: Array<{ workingDirectory: string | null; cost?: unknown; children?: unknown[] }>
) {
  for (const agent of agents) {
    if (agent.workingDirectory) {
      const cost = getAgentCost(agent.workingDirectory);
      if (cost) agent.cost = cost;
    }
    if (Array.isArray(agent.children)) {
      enrichAgentsWithCost(agent.children as typeof agents);
    }
  }
}

function flattenAgentsForCost(
  agents: Array<{ cost?: { totalCost: number }; children?: unknown[] }>
): Array<{ cost?: { totalCost: number } }> {
  const result: Array<{ cost?: { totalCost: number } }> = [];
  for (const agent of agents) {
    result.push(agent);
    if (Array.isArray(agent.children)) {
      result.push(...flattenAgentsForCost(agent.children as typeof agents));
    }
  }
  return result;
}

app.get('/api/agents', (_req, res) => {
  res.json(getFullState());
});

// ─── Agent control ──────────────────────────────────────

app.post('/api/agents/start', async (req, res) => {
  const { prompt, cwd } = req.body;
  if (!prompt || !cwd) {
    res.status(400).json({ success: false, error: 'prompt and cwd are required' });
    return;
  }
  const result = await startAgent({ prompt, cwd });
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/agents/:pid/stop', async (req, res) => {
  const pid = parseInt(req.params.pid);
  if (isNaN(pid)) {
    res.status(400).json({ error: 'Invalid PID' });
    return;
  }
  const force = req.query.force === 'true';
  const result = await stopAgent(pid, force);
  res.json(result);
});

// ─── Directory browsing ─────────────────────────────────

app.get('/api/directories', (req, res) => {
  const { path: dirPath } = req.query;
  if (!dirPath || typeof dirPath !== 'string') {
    res.status(400).json({ error: 'path query parameter is required' });
    return;
  }

  let parentDir: string;
  let prefix: string;

  if (dirPath.endsWith('/')) {
    parentDir = dirPath;
    prefix = '';
  } else {
    parentDir = path.dirname(dirPath);
    prefix = path.basename(dirPath).toLowerCase();
  }

  try {
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .filter(e => !prefix || e.name.toLowerCase().startsWith(prefix))
      .map(e => path.join(parentDir, e.name))
      .sort()
      .slice(0, 20);
    res.json({ directories: dirs });
  } catch {
    res.json({ directories: [] });
  }
});

// ─── Logs ───────────────────────────────────────────────

app.get('/api/agents/:pid/logs', (req, res) => {
  const { cwd } = req.query;
  if (!cwd || typeof cwd !== 'string') {
    res.status(400).json({ error: 'cwd query parameter is required' });
    return;
  }
  const logs = getSessionLogs(cwd);
  res.json({ logs });
});

app.get('/api/agents/:pid/full-logs', (req, res) => {
  const { cwd, search, limit } = req.query;
  if (!cwd || typeof cwd !== 'string') {
    res.status(400).json({ error: 'cwd query parameter is required' });
    return;
  }
  const logs = getFullSessionLogs(cwd, {
    search: typeof search === 'string' ? search : undefined,
    limit: typeof limit === 'string' ? parseInt(limit) || 200 : undefined,
  });
  res.json({ logs });
});

app.get('/api/sessions', (req, res) => {
  const { cwd } = req.query;
  if (!cwd || typeof cwd !== 'string') {
    res.status(400).json({ error: 'cwd query parameter is required' });
    return;
  }
  const sessions = getProjectSessions(cwd);
  res.json({ sessions });
});

// ─── Projects browser ────────────────────────────────────

app.get('/api/projects', (_req, res) => {
  const projects = getAllProjects();
  res.json({ projects });
});

// ─── Cost breakdown ──────────────────────────────────────

app.get('/api/costs/breakdown', (_req, res) => {
  const breakdown = getCostBreakdownByModel();
  res.json(breakdown);
});

// ─── Session replay ──────────────────────────────────────

app.get('/api/sessions/:projectId/:sessionId/replay', (req, res) => {
  const { projectId, sessionId } = req.params;
  const projectDir = path.join(
    os.homedir(),
    '.claude',
    'projects',
    projectId
  );
  const filePath = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Session file not found' });
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    interface ReplayMessage {
      type: 'user' | 'assistant';
      content: string;
      timestamp: string;
      model?: string;
      tokens?: { input: number; output: number };
    }

    const messages: ReplayMessage[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;
        if (!parsed.message) continue;

        let text = '';
        if (typeof parsed.message.content === 'string') {
          text = parsed.message.content;
        } else if (Array.isArray(parsed.message.content)) {
          text = parsed.message.content
            .filter((c: { type: string }) => c.type === 'text')
            .map((c: { text: string }) => c.text)
            .join('\n');
        }
        if (!text.trim()) continue;

        const msg: ReplayMessage = {
          type: parsed.type,
          content: text.slice(0, 5000),
          timestamp: parsed.timestamp || '',
        };

        if (parsed.type === 'assistant') {
          if (parsed.message.model) {
            msg.model = parsed.message.model;
          }
          if (parsed.message.usage) {
            msg.tokens = {
              input: parsed.message.usage.input_tokens || 0,
              output: parsed.message.usage.output_tokens || 0,
            };
          }
        }

        messages.push(msg);
      } catch {
        // skip malformed lines
      }
    }

    res.json({ messages });
  } catch {
    res.status(500).json({ error: 'Failed to read session file' });
  }
});

// ─── History ────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  const minutes = parseInt(String(req.query.minutes)) || 30;
  res.json({ history: getHistory(minutes) });
});

// ─── Events ─────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  const since = parseInt(String(req.query.since)) || undefined;
  res.json({ events: getEvents(since) });
});

// ─── API Agent registry ─────────────────────────────────

app.post('/api/register', (req, res) => {
  const { name, description, metadata, pid } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const agent = registerAgent({ name, description, metadata, pid });
  res.json(agent);
});

app.put('/api/register/:id', (req, res) => {
  const { status, metadata } = req.body;
  const agent = updateAgent(req.params.id, { status, metadata });
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

app.post('/api/register/:id/heartbeat', (req, res) => {
  const ok = heartbeat(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ ok: true });
});

app.delete('/api/register/:id', (req, res) => {
  deregisterAgent(req.params.id);
  res.json({ ok: true });
});

// ─── Workflows ──────────────────────────────────────────

app.get('/api/workflows', (_req, res) => {
  res.json({ workflows: getWorkflows() });
});

app.post('/api/workflows', (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !steps || !Array.isArray(steps)) {
    res.status(400).json({ error: 'name and steps are required' });
    return;
  }
  const workflow = createWorkflow({ name, description: description || '', steps });
  res.json(workflow);
});

app.get('/api/workflows/:id', (req, res) => {
  const workflow = getWorkflow(req.params.id);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
});

app.delete('/api/workflows/:id', (req, res) => {
  deleteWorkflow(req.params.id);
  res.json({ ok: true });
});

app.get('/api/workflows/:id/export', (req, res) => {
  const workflow = exportWorkflow(req.params.id);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.setHeader('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json"`);
  res.json(workflow);
});

app.post('/api/workflows/import', (req, res) => {
  const { name, steps } = req.body;
  if (!name || !steps || !Array.isArray(steps)) {
    res.status(400).json({ error: 'name and steps are required' });
    return;
  }
  const workflow = importWorkflow(req.body);
  res.json(workflow);
});

app.get('/api/workflow-templates', (_req, res) => {
  res.json({ templates: getWorkflowTemplates() });
});

app.post('/api/workflow-templates/:id/create', (req, res) => {
  const { cwd } = req.body;
  if (!cwd) {
    res.status(400).json({ error: 'cwd is required' });
    return;
  }
  const workflow = createWorkflowFromTemplate(req.params.id, cwd);
  if (!workflow) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(workflow);
});

app.post('/api/workflows/:id/run', (req, res) => {
  const run = startWorkflowRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(run);
});

app.get('/api/runs', (_req, res) => {
  res.json({ runs: getRuns() });
});

app.get('/api/runs/:id', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

app.post('/api/runs/:id/cancel', (req, res) => {
  const ok = cancelRun(req.params.id);
  if (!ok) {
    res.status(400).json({ error: 'Cannot cancel this run' });
    return;
  }
  res.json({ ok: true });
});

// ─── SPA fallback ───────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ─── WebSocket ──────────────────────────────────────────

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  // Send initial state with full history
  const state = getFullState();
  ws.send(
    JSON.stringify({
      ...state,
      history: getHistory(30),
    })
  );

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

setInterval(() => {
  if (wss.clients.size === 0) return;

  const state = getFullState();
  const message = JSON.stringify(state);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}, POLL_INTERVAL);

server.listen(PORT, () => {
  console.log(`Claude Agents Monitor running at http://localhost:${PORT}`);
});
