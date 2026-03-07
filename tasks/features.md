# Feature Roadmap

## Quick Wins (data already exists, just needs UI)

- [x] **Session-level cost tracking** — Extract per-session costs from JSONL logs and show them in the Projects tab
- [x] **Workflow persistence** — Save workflows to a JSON file on disk so they survive restarts
- [x] **Full log viewer** — Replace the 30-message truncated panel with a searchable, filterable log viewer
- [x] **Cost breakdown by model** — Pie/bar chart showing Opus vs Sonnet vs Haiku spend (pricing data already in `costs.ts`)
- [x] **Link running agents to projects** — Cross-reference agent working directories with the Projects tab to show which project an agent belongs to
- [x] **Configurable history window** — The API already supports `?minutes=N`, but the UI hardcodes 30 minutes

## Medium Effort, High Value

- [ ] **Cost history timeline** — Track costs over time instead of recalculating on-demand. Show a spend curve
- [ ] **Alert/threshold system** — Notify when agent CPU > X%, memory > Y%, or session cost exceeds a budget
- [ ] **Agent comparison view** — Select 2+ agents and compare metrics side-by-side
- [x] **Workflow output capture** — Store agent stdout/stderr per step so you can see what each step actually did
- [x] **Confirmation dialogs** — Stop/kill/delete are one-click with no undo. Add confirmation for destructive actions
- [x] **Project dashboard** — Unified view that merges running agents with their project metadata (sessions, branches, costs)
- [x] **Session replay** — Step through a completed session's user/assistant exchanges as a conversation view
- [x] **Workflow templates** — Pre-built workflow patterns (e.g., "code review", "refactor + test", "multi-repo sync")

## Larger Bets

- [ ] **Live agent output streaming** — Stream stdout/stderr from running agents to the UI in real-time via WebSocket
- [x] **Inter-agent messaging** — Pass data between workflow steps (step A's output becomes step B's context)
- [ ] **Multi-machine monitoring** — Connect multiple monitor instances across machines into one dashboard
- [ ] **Webhook/Slack notifications** — Push events (agent started, failed, cost threshold hit) to external services
- [ ] **Authentication & access control** — Currently anyone on the network can control agents
- [ ] **Agent scheduling** — Cron-like scheduling for recurring workflows (e.g., nightly code review agents)

## Polish & UX

- [ ] **Keyboard shortcuts for agent actions** — Quick-stop, quick-launch without mouse
- [ ] **Dark/light theme toggle** — Currently dark-only
- [ ] **Notification persistence** — Auto-dismiss at 5s is too fast; add a notification center/history
- [ ] **Memory file viewer** — Show and edit project memory contents from the Projects tab
- [x] **Export/import workflows** — Share workflow definitions as JSON files between team members

## Recommended Priority

1. Session-level cost tracking
2. Workflow persistence
3. Link running agents to projects
4. Cost history timeline
5. Workflow output capture
