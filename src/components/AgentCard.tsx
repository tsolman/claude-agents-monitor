import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ClaudeAgent, LogEntry } from '../types';
import { stopAgent, getAgentLogs, getFullAgentLogs } from '../hooks/useAgents';
import { ConfirmDialog } from './ConfirmDialog';

function formatCommand(command: string): string {
  return command
    .replace(/\/[^\s]*\/node_modules\//, '.../node_modules/')
    .replace(/\/[^\s]*\/.npm\/_npx\/[^/]+\//, '...npx/');
}

function extractProject(
  workingDirectory: string | null,
  command: string
): string | null {
  if (workingDirectory) {
    const parts = workingDirectory.split('/');
    return parts[parts.length - 1] || workingDirectory;
  }
  const match = command.match(/--project[= ](\S+)/);
  return match ? match[1] : null;
}

function cpuColor(cpu: number): string {
  if (cpu > 80) return '#f85149';
  if (cpu > 50) return '#d29922';
  return '#58a6ff';
}

function BarMini({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] w-12 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function parseStreamLine(line: string): { type: string; text: string } | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.type === 'assistant' && parsed.message?.content) {
      const content = parsed.message.content;
      if (typeof content === 'string') return { type: 'assistant', text: content };
      if (Array.isArray(content)) {
        const text = content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text)
          .join('');
        if (text) return { type: 'assistant', text };
      }
    }
    if (parsed.type === 'system') {
      const text = typeof parsed.message === 'string' ? parsed.message :
        parsed.subtype ? `[${parsed.subtype}]` : '[system]';
      return { type: 'system', text };
    }
    if (parsed.type === 'result') {
      const text = parsed.result || parsed.subtype || '[result]';
      return { type: 'result', text: typeof text === 'string' ? text : JSON.stringify(text) };
    }
    return null;
  } catch {
    return null;
  }
}

export function AgentCard({
  agent,
  depth = 0,
  agentOutputs = {},
}: {
  agent: ClaudeAgent;
  depth?: number;
  agentOutputs?: Record<number, string[]>;
}) {
  const [stopping, setStopping] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'stop' | 'kill'>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [loadMoreLevel, setLoadMoreLevel] = useState(0); // 0=initial(50), 1=100, 2=200
  const [showOutput, setShowOutput] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (showOutput && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showOutput, agentOutputs[agent.pid]?.length]);

  const project = extractProject(agent.workingDirectory, agent.command);
  const isSubagent = agent.type === 'subagent';
  const isApiAgent = agent.command.startsWith('[API]');

  const handleStopClick = () => {
    setConfirmAction(forceMode ? 'kill' : 'stop');
  };

  const handleConfirm = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'stop') {
      setStopping(true);
      await stopAgent(agent.pid);
      setStopping(false);
      setForceMode(true);
    } else if (action === 'kill') {
      setStopping(true);
      await stopAgent(agent.pid, true);
    }
  };

  const handleToggleLogs = async () => {
    if (showLogs) {
      setShowLogs(false);
      return;
    }
    if (!agent.workingDirectory) {
      setShowLogs(true);
      return;
    }
    setLogsLoading(true);
    setLoadMoreLevel(0);
    setSearchQuery('');
    setActiveSearch('');
    setExpandedEntries(new Set());
    try {
      const result = await getAgentLogs(agent.pid, agent.workingDirectory);
      setLogs(result.logs);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
      setShowLogs(true);
    }
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setActiveSearch('');
      // Reload initial logs
      if (agent.workingDirectory) {
        setSearchLoading(true);
        getAgentLogs(agent.pid, agent.workingDirectory)
          .then(result => setLogs(result.logs))
          .catch(() => setLogs([]))
          .finally(() => setSearchLoading(false));
      }
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      if (!agent.workingDirectory) return;
      setSearchLoading(true);
      getFullAgentLogs(agent.pid, agent.workingDirectory, value.trim())
        .then(result => {
          setLogs(result.logs);
          setActiveSearch(value.trim());
        })
        .catch(() => setLogs([]))
        .finally(() => setSearchLoading(false));
    }, 300);
  }, [agent.pid, agent.workingDirectory]);

  const handleLoadMore = useCallback(async () => {
    if (!agent.workingDirectory) return;
    const nextLevel = Math.min(loadMoreLevel + 1, 2);
    const limitMap = [50, 100, 200];
    const limit = limitMap[nextLevel];
    setSearchLoading(true);
    try {
      const result = await getFullAgentLogs(agent.pid, agent.workingDirectory);
      // We fetch all and slice on the client to the desired limit
      setLogs(result.logs.slice(-limit));
      setLoadMoreLevel(nextLevel);
    } catch {
      // keep existing logs
    } finally {
      setSearchLoading(false);
    }
  }, [agent.pid, agent.workingDirectory, loadMoreLevel]);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const highlightMatches = useMemo(() => {
    if (!activeSearch) return null;
    const escaped = activeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${escaped})`, 'gi');
  }, [activeSearch]);

  const matchCount = useMemo(() => {
    if (!activeSearch) return 0;
    return logs.length;
  }, [activeSearch, logs]);

  const accentColor = isApiAgent
    ? '#bc8cff'
    : isSubagent
      ? '#56d4dd'
      : '#3fb950';

  return (
    <div className={depth > 0 ? 'ml-8 mt-2' : ''}>
      <div
        className={`card card-glow relative overflow-hidden transition-all ${
          isSubagent ? 'opacity-80' : ''
        }`}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 h-full w-[2px]"
          style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
        />

        <div className="px-5 py-4">
          {/* Top row: name + project + metrics */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Status dot with animated ring */}
              <div className="relative flex shrink-0 items-center justify-center" style={{ width: 16, height: 16 }}>
                <span
                  className="absolute h-2 w-2 rounded-full animate-ring-pulse"
                  style={{ background: `${accentColor}30` }}
                />
                <span
                  className="relative block h-2 w-2 rounded-full"
                  style={{
                    background: accentColor,
                    boxShadow: `0 0 6px ${accentColor}60`,
                  }}
                />
              </div>

              {/* Name + project */}
              <div className="flex items-baseline gap-2.5 min-w-0">
                {project ? (
                  <>
                    <span className="text-[14px] font-bold text-white/90 truncate">
                      {project}
                    </span>
                    <span className="text-[11px] font-medium text-white/30">
                      {isApiAgent
                        ? 'API Agent'
                        : isSubagent
                          ? 'Subagent'
                          : 'Agent'}
                    </span>
                  </>
                ) : (
                  <span className="text-[14px] font-bold text-white/90">
                    {isApiAgent
                      ? 'API Agent'
                      : isSubagent
                        ? 'Subagent'
                        : 'Agent'}
                  </span>
                )}
                <span className="font-mono text-[10px] text-white/15">
                  {agent.pid}
                </span>
              </div>
            </div>

            {/* Metrics strip */}
            <div className="flex shrink-0 items-center gap-5">
              {!isApiAgent && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-white/20">
                      CPU
                    </span>
                    <span
                      className="metric-value text-[12px]"
                      style={{ color: cpuColor(agent.cpu) }}
                    >
                      {agent.cpu.toFixed(1)}%
                    </span>
                    <BarMini value={agent.cpu} color={cpuColor(agent.cpu)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-white/20">
                      MEM
                    </span>
                    <span className="metric-value text-[12px] text-data-purple">
                      {agent.memory.toFixed(1)}%
                    </span>
                    <BarMini value={agent.memory} color="#bc8cff" />
                  </div>
                </>
              )}
              <div>
                <span className="font-mono text-[10px] text-white/20">UP </span>
                <span className="metric-value text-[12px] text-white/50">
                  {agent.elapsed}
                </span>
              </div>
              {agent.cost && agent.cost.totalCost > 0 && (
                <div className="flex items-center gap-1.5" title={`In: ${agent.cost.inputTokens.toLocaleString()} · Out: ${agent.cost.outputTokens.toLocaleString()} · Cache W: ${agent.cost.cacheWriteTokens.toLocaleString()} · Cache R: ${agent.cost.cacheReadTokens.toLocaleString()}`}>
                  <span className="font-mono text-[10px] text-white/20">
                    COST
                  </span>
                  <span className="metric-value text-[12px] text-accent">
                    ${agent.cost.totalCost < 0.01
                      ? agent.cost.totalCost.toFixed(4)
                      : agent.cost.totalCost.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 border-l border-border-subtle pl-4">
                {agent.workingDirectory && (
                  <button
                    onClick={handleToggleLogs}
                    className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-all ${
                      showLogs
                        ? 'bg-data-blue-dim text-data-blue ring-1 ring-data-blue/20'
                        : 'text-white/20 hover:bg-surface-3 hover:text-white/40'
                    }`}
                  >
                    LOGS
                  </button>
                )}
                {agentOutputs[agent.pid] && agentOutputs[agent.pid].length > 0 && (
                  <button
                    onClick={() => setShowOutput(!showOutput)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-all ${
                      showOutput
                        ? 'bg-live-dim text-live ring-1 ring-live/20'
                        : 'text-white/20 hover:bg-surface-3 hover:text-white/40'
                    }`}
                  >
                    OUTPUT
                  </button>
                )}
                {agent.pid > 0 && (
                  <button
                    onClick={handleStopClick}
                    disabled={stopping}
                    className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-all disabled:opacity-30 ${
                      forceMode
                        ? 'bg-danger-dim text-danger ring-1 ring-danger/20 hover:bg-danger/20'
                        : 'text-white/20 hover:bg-danger-dim hover:text-danger'
                    }`}
                  >
                    {stopping ? '...' : forceMode ? 'FORCE KILL' : 'STOP'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Working directory */}
          {agent.workingDirectory && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/12">cwd</span>
              <span className="font-mono text-[11px] text-white/25">
                {agent.workingDirectory}
              </span>
            </div>
          )}

          {/* Command */}
          <div className="mt-1 truncate font-mono text-[10px] text-white/12">
            {formatCommand(agent.command)}
          </div>

          {/* Logs panel */}
          {showLogs && (
            <div className="mt-4 rounded-lg bg-surface-0 ring-1 ring-border-subtle">
              {/* Search bar */}
              <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-white/20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search logs..."
                  className="input-field flex-1 border-0 bg-transparent px-0 py-0 text-[11px] ring-0 focus:ring-0"
                />
                {searchLoading && (
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/10 border-t-accent/50" />
                )}
                {activeSearch && !searchLoading && (
                  <span className="font-mono text-[10px] text-accent/60">
                    {matchCount} match{matchCount !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {/* Log entries */}
              <div className="max-h-96 overflow-y-auto p-4">
                {logsLoading ? (
                  <div className="flex items-center gap-2 font-mono text-[11px] text-white/20">
                    <div className="h-3 w-3 animate-spin rounded-full border border-white/10 border-t-accent/50" />
                    loading session logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="font-mono text-[11px] text-white/15">
                    {activeSearch ? 'No matches found' : 'No session logs found for this working directory.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log, i) => {
                      const isLong = log.content.length > 500;
                      const isExpanded = expandedEntries.has(i);
                      const displayContent = isLong && !isExpanded
                        ? log.content.slice(0, 500) + '...'
                        : log.content;

                      return (
                        <div key={i}>
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`font-mono text-[10px] font-semibold uppercase tracking-wide ${
                                log.type === 'user'
                                  ? 'text-data-blue'
                                  : 'text-live'
                              }`}
                            >
                              {log.type === 'user' ? 'you' : 'claude'}
                            </span>
                            <span className="font-mono text-[9px] text-white/10">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/35">
                            {highlightMatches
                              ? displayContent.split(highlightMatches).map((part, j) =>
                                  j % 2 === 1
                                    ? <span key={j} className="bg-accent/20 text-accent">{part}</span>
                                    : part
                                )
                              : displayContent}
                          </div>
                          {isLong && (
                            <button
                              onClick={() => toggleExpanded(i)}
                              className="mt-1 text-[10px] text-accent/50 hover:text-accent transition-colors"
                            >
                              {isExpanded ? 'show less' : 'show more'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Load more */}
                {!logsLoading && !activeSearch && logs.length > 0 && loadMoreLevel < 2 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={searchLoading}
                      className="text-[11px] text-accent/50 hover:text-accent transition-colors disabled:opacity-30"
                    >
                      {searchLoading ? 'Loading...' : `Load More (${[100, 200][loadMoreLevel]} messages)`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live output panel */}
          {showOutput && agentOutputs[agent.pid] && (
            <div className="mt-4 rounded-lg bg-surface-0 ring-1 ring-border-subtle">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-live animate-pulse" />
                  <span className="font-mono text-[10px] font-semibold text-live/70">LIVE OUTPUT</span>
                </div>
                <span className="font-mono text-[9px] text-white/15">
                  {agentOutputs[agent.pid].length} lines
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto p-4">
                <div className="space-y-1">
                  {agentOutputs[agent.pid].map((line, i) => {
                    const parsed = parseStreamLine(line);
                    if (!parsed) return null;
                    return (
                      <div key={i} className="font-mono text-[11px] leading-relaxed">
                        {parsed.type === 'system' ? (
                          <span className="text-white/15">{parsed.text}</span>
                        ) : parsed.type === 'result' ? (
                          <span className="text-accent/60">{parsed.text}</span>
                        ) : (
                          <span className="text-white/40">{parsed.text}</span>
                        )}
                      </div>
                    );
                  })}
                  <div ref={outputEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {agent.children.length > 0 && (
        <div className="relative ml-5 border-l border-border-subtle/40 pl-0">
          {agent.children.map(child => (
            <AgentCard key={child.pid} agent={child} depth={depth + 1} agentOutputs={agentOutputs} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === 'stop'}
        title="Stop Agent"
        message={`This will gracefully terminate agent PID ${agent.pid}${project ? ` working on ${project}` : ''}. Continue?`}
        confirmLabel="Stop"
        confirmVariant="warning"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'kill'}
        title="Force Kill Agent"
        message={`This will forcefully terminate agent PID ${agent.pid}. Unsaved work may be lost. Continue?`}
        confirmLabel="Force Kill"
        confirmVariant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
