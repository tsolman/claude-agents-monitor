# Claude Agents Monitor

Real-time dashboard for monitoring, controlling, and orchestrating Claude Code agents.

Built for developers running agent swarms who need visibility and control across multiple Claude sessions.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

**Monitoring**
- Auto-discovers all running Claude Code processes
- Detects parent/child relationships (main agents vs subagents)
- Shows CPU, memory, uptime, working directory per agent
- Real-time updates via WebSocket (2s intervals)
- Works on macOS and Linux

**Cost Tracking**
- Per-agent cost estimation from Claude Code session logs
- Sums input, output, cache write, and cache read tokens
- Model-aware pricing (Opus, Sonnet, Haiku)
- Total session cost across all agents in the dashboard
- Token breakdown on hover

**Agent Control**
- Stop running agents from the dashboard (with force-kill escalation)
- Launch new agents with a prompt and working directory
- View session logs inline (parses Claude Code's JSONL conversation logs)

**Workflows**
- Define multi-step agent workflows with dependencies
- Steps run in parallel when dependencies allow
- Monitor step progress in real-time
- Cancel running workflows

**History & Metrics**
- Time-series charts for agent count, CPU, and memory
- 30-minute rolling history with responsive sparklines
- Peak and average resource stats

**Notifications**
- Toast notifications when agents start or stop
- Auto-dismiss after 5 seconds

**API Agent Registration**
- Register custom Claude API agents via REST endpoint
- Heartbeat system with auto-stale detection
- Merged into the unified dashboard view

## Quick Start

```bash
git clone https://github.com/ktsolakidis/claude-agents-monitor.git
cd claude-agents-monitor
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

For production:

```bash
npm run build
npm start
# Dashboard at http://localhost:3100
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Monitor tab |
| `2` | Switch to Workflows tab |
| `3` | Switch to History tab |

## API

### Agent Monitoring
- `GET /api/agents` — Current agent state (includes cost data)
- `POST /api/agents/start` — Launch agent `{ prompt, cwd }`
- `POST /api/agents/:pid/stop?force=true` — Stop agent (optional force kill)
- `GET /api/agents/:pid/logs?cwd=...` — Session logs

### History & Events
- `GET /api/history?minutes=30` — Time-series data
- `GET /api/events?since=timestamp` — Lifecycle events

### Workflows
- `GET /api/workflows` — List workflows
- `POST /api/workflows` — Create workflow
- `DELETE /api/workflows/:id` — Delete workflow
- `POST /api/workflows/:id/run` — Start workflow run
- `GET /api/runs` — List runs
- `POST /api/runs/:id/cancel` — Cancel run

### API Agent Registration
- `POST /api/register` — Register `{ name, description?, metadata?, pid? }`
- `PUT /api/register/:id` — Update `{ status?, metadata? }`
- `POST /api/register/:id/heartbeat` — Keep alive
- `DELETE /api/register/:id` — Deregister

### WebSocket
- `ws://host/ws` — Real-time agent state + events

## Registering Custom Agents

Any process using the Claude API can register itself with the monitor:

```javascript
// At startup
const res = await fetch('http://localhost:3100/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My RAG Agent',
    description: 'Processes customer queries',
    metadata: { model: 'claude-sonnet-4-20250514' },
    pid: process.pid,
  }),
});
const { id } = await res.json();

// Heartbeat every 15s
setInterval(() => {
  fetch(`http://localhost:3100/api/register/${id}/heartbeat`, { method: 'POST' });
}, 15000);

// On shutdown
await fetch(`http://localhost:3100/api/register/${id}`, { method: 'DELETE' });
```

## Architecture

```
server/
  index.ts          Express + WebSocket server
  monitor.ts        Process discovery via ps
  control.ts        Start/stop agents
  logs.ts           Claude Code session log parser
  costs.ts          Token usage extraction + cost estimation
  history.ts        In-memory time-series store
  notifications.ts  Agent lifecycle event tracking
  workflows.ts      Multi-step workflow engine
  registry.ts       API agent registration
  types.ts          Shared types

src/
  App.tsx                   Tabbed layout (Monitor, Workflows, History)
  hooks/useAgents.ts        WebSocket + API client
  components/
    Dashboard.tsx           Agent list + sparklines + launch button
    AgentCard.tsx           Agent details, logs, cost, stop/force-kill
    HistoryView.tsx         Resource charts
    WorkflowView.tsx        Workflow CRUD + runner
    LaunchModal.tsx         New agent dialog
    Notifications.tsx       Toast notifications
    Sparkline.tsx           Responsive SVG sparkline charts
```

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Express, WebSocket (ws), tsx
- **Process discovery:** `ps` command parsing + `lsof`/`readlink` for cwd
- **Cost data:** Parsed from Claude Code's JSONL session logs (`~/.claude/projects/`)

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT`  | `3100`  | Server port |

## Roadmap

- [ ] Persistent workflow storage (file-based)
- [ ] Agent output capture and streaming
- [ ] Inter-agent communication channels
- [ ] Multi-machine monitoring
- [ ] Webhook notifications (Slack, email)
- [ ] Cost history tracking over time

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
