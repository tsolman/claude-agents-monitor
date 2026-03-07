import { useState, useEffect, useMemo } from 'react';
import type { ClaudeAgent, ProjectInfo, MonitorState, SessionEntry } from '../types';
import { getProjects } from '../hooks/useAgents';
import { SessionReplay } from './SessionReplay';

function formatDate(iso: string): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function formatFullDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function flattenAgents(agents: ClaudeAgent[]): ClaudeAgent[] {
  const result: ClaudeAgent[] = [];
  for (const agent of agents) {
    result.push(agent);
    if (agent.children && agent.children.length > 0) {
      result.push(...flattenAgents(agent.children));
    }
  }
  return result;
}

function matchAgentToProject(agent: ClaudeAgent, projects: ProjectInfo[]): ProjectInfo | null {
  if (!agent.workingDirectory) return null;
  let best: ProjectInfo | null = null;
  for (const project of projects) {
    if (agent.workingDirectory.startsWith(project.path) && (!best || project.path.length > best.path.length)) {
      best = project;
    }
  }
  return best;
}

interface EnrichedProject {
  project: ProjectInfo;
  agents: ClaudeAgent[];
}

export function ProjectDashboard() {
  const [agents, setAgents] = useState<ClaudeAgent[]>([]);
  const [agentState, setAgentState] = useState<MonitorState | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showAllIdle, setShowAllIdle] = useState(false);

  // Fetch agents every 5 seconds
  useEffect(() => {
    let cancelled = false;
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents');
        const data: MonitorState = await res.json();
        if (!cancelled) {
          setAgents(data.agents || []);
          setAgentState(data);
        }
      } catch {
        // silently fail
      }
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Fetch projects every 30 seconds
  useEffect(() => {
    let cancelled = false;
    async function fetchProjects() {
      try {
        const { projects: data } = await getProjects();
        if (!cancelled) {
          setProjects(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProjects();
    const interval = setInterval(fetchProjects, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const allFlatAgents = useMemo(() => flattenAgents(agents), [agents]);

  const { activeProjects, idleProjects } = useMemo(() => {
    const projectAgentMap = new Map<string, ClaudeAgent[]>();

    for (const agent of allFlatAgents) {
      const matched = matchAgentToProject(agent, projects);
      if (matched) {
        const existing = projectAgentMap.get(matched.id) || [];
        existing.push(agent);
        projectAgentMap.set(matched.id, existing);
      }
    }

    const active: EnrichedProject[] = [];
    const idle: ProjectInfo[] = [];

    for (const project of projects) {
      const matchedAgents = projectAgentMap.get(project.id);
      if (matchedAgents && matchedAgents.length > 0) {
        active.push({ project, agents: matchedAgents });
      } else {
        idle.push(project);
      }
    }

    // Sort idle by last activity, most recent first
    idle.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    return { activeProjects: active, idleProjects: idle };
  }, [projects, allFlatAgents]);

  const totalRunningAgents = agentState?.totalCount ?? 0;
  const totalCost = projects.reduce((sum, p) => sum + p.totalCost, 0);
  const totalSessions = projects.reduce((sum, p) => sum + p.totalSessions, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="relative mb-6 h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/5 border-t-accent/60" />
          <div className="absolute inset-1.5 animate-spin rounded-full border border-white/5 border-t-accent/30" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="font-mono text-xs text-white/20">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Summary cards row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Active Projects"
          value={activeProjects.length}
          color="#3fb950"
        />
        <SummaryCard
          label="Running Agents"
          value={totalRunningAgents}
          color="#e8a23e"
        />
        <SummaryCard
          label="Total Cost"
          value={formatCost(totalCost)}
          color="#e8a23e"
        />
        <SummaryCard
          label="Total Sessions"
          value={totalSessions}
          color="#58a6ff"
        />
      </div>

      {/* Active Projects section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
            Active Projects
          </h2>
          <span className="rounded-full bg-live-dim px-2 py-0.5 font-mono text-[10px] font-semibold text-live ring-1 ring-live/15">
            {activeProjects.length}
          </span>
        </div>

        {activeProjects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-white/20 text-sm">No projects have running agents right now.</div>
          </div>
        ) : (
          <div className="space-y-3 stagger-in">
            {activeProjects.map(({ project, agents: projectAgents }) => (
              <ActiveProjectCard
                key={project.id}
                project={project}
                agents={projectAgents}
                expanded={expandedProject === project.id}
                onToggle={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Idle Projects section */}
      {idleProjects.length > 0 && (
        <IdleProjectsSection
          projects={idleProjects}
          showAll={showAllIdle}
          onToggleShowAll={() => setShowAllIdle(!showAllIdle)}
          expandedProject={expandedProject}
          onToggleExpand={(id) => setExpandedProject(expandedProject === id ? null : id)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card card-glow relative overflow-hidden p-4">
      <div
        className="absolute left-0 top-0 h-full w-[2px] shimmer-bar"
        style={{ '--shimmer-color': `${color}40` } as React.CSSProperties}
      />
      <div className="text-[10px] font-medium uppercase tracking-widest text-white/25">
        {label}
      </div>
      <div
        className="metric-value mt-1.5 text-2xl"
        style={{ color, textShadow: `0 0 20px ${color}30` }}
      >
        {value}
      </div>
    </div>
  );
}

function ActiveProjectCard({
  project,
  agents: projectAgents,
  expanded,
  onToggle,
}: {
  project: ProjectInfo;
  agents: ClaudeAgent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`card card-glow overflow-hidden ring-1 ring-live/20 transition-all ${expanded ? 'ring-accent/20' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-live-dim ring-1 ring-live/20">
              <span className="font-mono text-xs font-bold text-live">
                {project.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white/90">{project.name}</h3>
              <p className="text-[11px] font-mono text-white/25 mt-0.5">{project.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-live-dim px-2 py-0.5 text-[9px] font-mono text-live ring-1 ring-live/15">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-glow-pulse" />
              ACTIVE
            </span>
            <svg className={`w-4 h-4 text-white/20 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Running agents */}
        <div className="mb-3 space-y-1">
          {projectAgents.map(agent => (
            <div key={agent.pid} className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-live" />
              <span className="font-mono text-white/50">
                {agent.type === 'subagent' ? 'subagent' : 'agent'}
              </span>
              <span className="font-mono text-white/30">PID {agent.pid}</span>
              <span className="font-mono text-data-blue">{agent.cpu}% CPU</span>
              <span className="font-mono text-data-purple">{agent.memory}% MEM</span>
              <span className="font-mono text-white/25">{agent.elapsed}</span>
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Sessions</span>
            <span className="metric-value text-data-blue">{project.totalSessions}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Messages</span>
            <span className="metric-value text-data-cyan">{project.totalMessages.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Cost</span>
            <span className="metric-value text-accent">{formatCost(project.totalCost)}</span>
          </div>
          <div className="ml-auto text-white/25">
            {formatDate(project.lastActivity)}
          </div>
        </div>

        {/* Branches */}
        {project.branches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {project.branches.slice(0, 5).map(branch => (
              <span key={branch} className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-mono text-white/40">
                {branch}
              </span>
            ))}
            {project.branches.length > 5 && (
              <span className="text-[10px] text-white/20">+{project.branches.length - 5} more</span>
            )}
          </div>
        )}
      </button>

      {/* Expanded session list */}
      {expanded && (
        <SessionList sessions={project.sessions} projectId={project.id} />
      )}
    </div>
  );
}

function IdleProjectsSection({
  projects,
  showAll,
  onToggleShowAll,
  expandedProject,
  onToggleExpand,
}: {
  projects: ProjectInfo[];
  showAll: boolean;
  onToggleShowAll: () => void;
  expandedProject: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const displayed = showAll ? projects : projects.slice(0, 6);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-4 flex items-center gap-3 group"
      >
        <svg className={`w-3 h-3 text-white/20 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors">
          Idle Projects
        </h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-white/30">
          {projects.length}
        </span>
      </button>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger-in">
            {displayed.map(project => (
              <IdleProjectCard
                key={project.id}
                project={project}
                expanded={expandedProject === project.id}
                onToggle={() => onToggleExpand(project.id)}
              />
            ))}
          </div>

          {projects.length > 6 && (
            <button
              onClick={onToggleShowAll}
              className="mt-4 w-full rounded-lg border border-border-subtle/60 py-2.5 text-[12px] text-white/30 hover:text-white/50 hover:border-border transition-colors"
            >
              {showAll ? 'Show less' : `Show all ${projects.length} idle projects`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function IdleProjectCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectInfo;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`card overflow-hidden transition-all ${expanded ? 'ring-1 ring-accent/20' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 ring-1 ring-white/5">
            <span className="font-mono text-[10px] font-bold text-white/30">
              {project.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-medium text-white/60 truncate">{project.name}</h3>
          </div>
          <svg className={`w-3.5 h-3.5 text-white/15 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-white/20">Sessions</span>
            <span className="metric-value text-white/40">{project.totalSessions}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/20">Cost</span>
            <span className="metric-value text-white/40">{formatCost(project.totalCost)}</span>
          </div>
          <div className="ml-auto text-white/20">
            {formatDate(project.lastActivity)}
          </div>
        </div>
      </button>

      {expanded && (
        <SessionList sessions={project.sessions} projectId={project.id} />
      )}
    </div>
  );
}

function SessionList({ sessions, projectId }: { sessions: SessionEntry[]; projectId: string }) {
  const [showAll, setShowAll] = useState(false);
  const [replaySession, setReplaySession] = useState<SessionEntry | null>(null);
  const displayed = showAll ? sessions : sessions.slice(0, 8);

  return (
    <div className="border-t border-border-subtle/60">
      <div className="px-5 py-2 flex items-center justify-between bg-surface-1/30">
        <span className="text-[11px] font-mono text-white/30 uppercase tracking-wider">
          Sessions ({sessions.length})
        </span>
        <div className="flex gap-4 text-[10px] font-mono text-white/20 uppercase tracking-wider">
          <span className="w-32">Prompt</span>
          <span className="w-14 text-right">Messages</span>
          <span className="w-14 text-right">Cost</span>
          <span className="w-20 text-right">Branch</span>
          <span className="w-28 text-right">Created</span>
          <span className="w-20 text-right">Last Active</span>
        </div>
      </div>

      <div className="divide-y divide-border-subtle/30">
        {displayed.map(session => (
          <SessionRow key={session.sessionId} session={session} onReplay={() => setReplaySession(session)} />
        ))}
      </div>

      {sessions.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 text-[12px] text-accent/60 hover:text-accent transition-colors bg-surface-1/20"
        >
          {showAll ? 'Show less' : `Show all ${sessions.length} sessions`}
        </button>
      )}

      {replaySession && (
        <SessionReplay
          projectId={projectId}
          sessionId={replaySession.sessionId}
          sessionPrompt={replaySession.firstPrompt}
          onClose={() => setReplaySession(null)}
        />
      )}
    </div>
  );
}

function SessionRow({ session, onReplay }: { session: SessionEntry; onReplay: () => void }) {
  const prompt = session.firstPrompt === 'No prompt' ? '' : session.firstPrompt;

  return (
    <div className="px-5 py-2.5 flex items-center justify-between hover:bg-surface-2/30 transition-colors group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {session.isSidechain ? (
          <span className="w-1.5 h-1.5 rounded-full bg-warn/60 shrink-0" title="Sidechain session" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-live/40 shrink-0" />
        )}
        <button
          onClick={e => { e.stopPropagation(); onReplay(); }}
          className="opacity-0 group-hover:opacity-100 text-[9px] font-mono text-data-blue/60 hover:text-data-blue px-1.5 py-0.5 rounded bg-data-blue-dim/0 hover:bg-data-blue-dim transition-all shrink-0"
        >
          REPLAY
        </button>
        <span className="text-[12px] text-white/50 truncate max-w-md" title={prompt || 'No prompt'}>
          {prompt ? truncate(prompt, 80) : <span className="italic text-white/20">No prompt</span>}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px] shrink-0">
        <span className="metric-value text-white/40 w-14 text-right">
          {session.messageCount > 0 ? session.messageCount : '-'}
        </span>
        <span className="metric-value text-accent/60 w-14 text-right">
          {session.cost > 0 ? formatCost(session.cost) : '-'}
        </span>
        <span className="w-20 text-right">
          {session.gitBranch ? (
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] font-mono text-white/35">
              {truncate(session.gitBranch, 12)}
            </span>
          ) : (
            <span className="text-white/10">-</span>
          )}
        </span>
        <span className="w-28 text-right font-mono text-white/25" title={formatFullDate(session.created)}>
          {formatFullDate(session.created)}
        </span>
        <span className="w-20 text-right font-mono text-white/25">
          {formatDate(session.modified)}
        </span>
      </div>
    </div>
  );
}
