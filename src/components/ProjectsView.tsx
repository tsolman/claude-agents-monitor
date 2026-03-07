import { useState, useEffect, useMemo } from 'react';
import type { ProjectInfo, SessionEntry, ClaudeAgent } from '../types';
import { getProjects } from '../hooks/useAgents';
import { SessionReplay } from './SessionReplay';

function projectHasRunningAgent(project: ProjectInfo, cwds: string[]): boolean {
  // Require project path to be specific enough (at least 3 segments like /Users/foo/repo)
  // to avoid broad matches like /Users/foo matching every agent
  const segments = project.path.split('/').filter(Boolean);
  if (segments.length < 3) return false;
  return cwds.some(cwd => cwd.startsWith(project.path));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatFullDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

type SortKey = 'recent' | 'sessions' | 'messages' | 'name' | 'size' | 'active';

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [agentCwds, setAgentCwds] = useState<string[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchAgentCwds() {
      try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        if (!cancelled) {
          const cwds: string[] = [];
          function collectCwds(agents: ClaudeAgent[]) {
            for (const agent of agents) {
              if (agent.workingDirectory) cwds.push(agent.workingDirectory);
              if (agent.children) collectCwds(agent.children);
            }
          }
          collectCwds(data.agents || []);
          setAgentCwds(cwds);
        }
      } catch {
        // silently fail
      }
    }
    fetchAgentCwds();
    const interval = setInterval(fetchAgentCwds, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function loadProjects() {
    try {
      const { projects: data } = await getProjects();
      setProjects(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = projects;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.branches.some(b => b.toLowerCase().includes(q)) ||
        p.sessions.some(s => s.firstPrompt.toLowerCase().includes(q))
      );
    }

    const sorted = [...result];
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
        break;
      case 'sessions':
        sorted.sort((a, b) => b.totalSessions - a.totalSessions);
        break;
      case 'messages':
        sorted.sort((a, b) => b.totalMessages - a.totalMessages);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        sorted.sort((a, b) => b.diskSize - a.diskSize);
        break;
      case 'active':
        sorted.sort((a, b) => {
          const aActive = projectHasRunningAgent(a, agentCwds) ? 1 : 0;
          const bActive = projectHasRunningAgent(b, agentCwds) ? 1 : 0;
          if (bActive !== aActive) return bActive - aActive;
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });
        break;
    }
    return sorted;
  }, [projects, search, sortBy, agentCwds]);

  const totalSessions = projects.reduce((sum, p) => sum + p.totalSessions, 0);
  const totalMessages = projects.reduce((sum, p) => sum + p.totalMessages, 0);
  const totalCost = projects.reduce((sum, p) => sum + p.totalCost, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-white/30 text-sm">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">Projects</div>
          <div className="metric-value text-2xl text-data-blue">{projects.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">Total Sessions</div>
          <div className="metric-value text-2xl text-data-purple">{totalSessions}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">Total Messages</div>
          <div className="metric-value text-2xl text-data-cyan">{totalMessages.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">Total Cost</div>
          <div className="metric-value text-2xl text-accent">{formatCost(totalCost)}</div>
        </div>
      </div>

      {/* Search and controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search projects, branches, prompts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-white/70 outline-none cursor-pointer hover:border-border-strong transition-colors"
        >
          <option value="recent">Most Recent</option>
          <option value="active">Active First</option>
          <option value="sessions">Most Sessions</option>
          <option value="messages">Most Messages</option>
          <option value="name">Name A-Z</option>
          <option value="size">Largest</option>
        </select>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'grid' ? 'bg-accent-dim text-accent' : 'bg-surface-1 text-white/30 hover:text-white/50'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zM2.5 2a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3zm6.5.5A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3zM1 10.5A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3zm6.5.5A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3zm1.5-.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5h-3z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-accent-dim text-accent' : 'bg-surface-1 text-white/30 hover:text-white/50'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z" />
            </svg>
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={loadProjects}
          className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-white/30 hover:text-white/50 hover:border-border-strong transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Results count */}
      {search && (
        <div className="text-[12px] text-white/30">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''} matching "{search}"
        </div>
      )}

      {/* Projects grid/list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-white/20 text-sm">
            {search ? 'No projects match your search.' : 'No projects found in ~/.claude/projects/'}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-in">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              expanded={expandedProject === project.id}
              onToggle={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
              isActive={projectHasRunningAgent(project, agentCwds)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 stagger-in">
          {filtered.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              expanded={expandedProject === project.id}
              onToggle={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
              isActive={projectHasRunningAgent(project, agentCwds)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, expanded, onToggle, isActive }: { project: ProjectInfo; expanded: boolean; onToggle: () => void; isActive: boolean }) {
  return (
    <div className={`card card-glow overflow-hidden transition-all ${expanded ? 'ring-1 ring-accent/20' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-data-blue-dim ring-1 ring-data-blue/20">
              <span className="font-mono text-xs font-bold text-data-blue">
                {project.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white/90">{project.name}</h3>
              <p className="text-[11px] font-mono text-white/25 mt-0.5">{project.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="flex items-center gap-1.5 rounded-full bg-live-dim px-2 py-0.5 text-[9px] font-mono text-live ring-1 ring-live/15">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-glow-pulse" />
                ACTIVE
              </span>
            )}
            {project.hasMemory && (
              <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-mono text-accent/70" title="Has project memory">
                MEMORY
              </span>
            )}
            <svg className={`w-4 h-4 text-white/20 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Sessions</span>
            <span className="metric-value text-data-purple">{project.totalSessions}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Messages</span>
            <span className="metric-value text-data-cyan">{project.totalMessages.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Cost</span>
            <span className="metric-value text-accent">{formatCost(project.totalCost)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">Size</span>
            <span className="metric-value text-white/50">{formatBytes(project.diskSize)}</span>
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

function ProjectRow({ project, expanded, onToggle, isActive }: { project: ProjectInfo; expanded: boolean; onToggle: () => void; isActive: boolean }) {
  return (
    <div className={`card card-glow overflow-hidden transition-all ${expanded ? 'ring-1 ring-accent/20' : ''}`}>
      <button onClick={onToggle} className="w-full text-left px-5 py-3.5 flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-data-blue-dim ring-1 ring-data-blue/20 shrink-0">
          <span className="font-mono text-[10px] font-bold text-data-blue">
            {project.name.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-white/90 truncate">{project.name}</h3>
            {isActive && (
              <span className="rounded-full bg-live-dim px-1.5 py-0.5 text-[9px] font-mono text-live shrink-0">ACTIVE</span>
            )}
            {project.hasMemory && (
              <span className="rounded-full bg-accent-dim px-1.5 py-0.5 text-[9px] font-mono text-accent/70 shrink-0">MEM</span>
            )}
          </div>
          <p className="text-[11px] font-mono text-white/20 truncate">{project.path}</p>
        </div>

        <div className="flex items-center gap-6 text-[12px] shrink-0">
          <div className="text-right w-16">
            <span className="metric-value text-data-purple">{project.totalSessions}</span>
            <span className="text-white/20 ml-1">sess</span>
          </div>
          <div className="text-right w-20">
            <span className="metric-value text-data-cyan">{project.totalMessages.toLocaleString()}</span>
            <span className="text-white/20 ml-1">msg</span>
          </div>
          <div className="text-right w-16">
            <span className="metric-value text-accent">{formatCost(project.totalCost)}</span>
          </div>
          <div className="text-right w-16">
            <span className="text-white/30">{formatBytes(project.diskSize)}</span>
          </div>
          <div className="text-right w-16 text-white/25">
            {formatDate(project.lastActivity)}
          </div>

          {project.branches.length > 0 && (
            <div className="flex gap-1 w-24 justify-end">
              {project.branches.slice(0, 2).map(branch => (
                <span key={branch} className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] font-mono text-white/35 truncate max-w-[60px]">
                  {branch}
                </span>
              ))}
              {project.branches.length > 2 && (
                <span className="text-[9px] text-white/20">+{project.branches.length - 2}</span>
              )}
            </div>
          )}

          <svg className={`w-4 h-4 text-white/20 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
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
