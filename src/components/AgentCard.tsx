import { useState } from 'react';
import type { ClaudeAgent, LogEntry } from '../types';
import { stopAgent, getAgentLogs } from '../hooks/useAgents';
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

export function AgentCard({
  agent,
  depth = 0,
}: {
  agent: ClaudeAgent;
  depth?: number;
}) {
  const [stopping, setStopping] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'stop' | 'kill'>(null);

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
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg bg-surface-0 p-4 ring-1 ring-border-subtle">
              {logsLoading ? (
                <div className="flex items-center gap-2 font-mono text-[11px] text-white/20">
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/10 border-t-accent/50" />
                  loading session logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="font-mono text-[11px] text-white/15">
                  No session logs found for this working directory.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, i) => (
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
                        {log.content.length > 500
                          ? log.content.slice(0, 500) + '...'
                          : log.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {agent.children.length > 0 && (
        <div className="relative ml-5 border-l border-border-subtle/40 pl-0">
          {agent.children.map(child => (
            <AgentCard key={child.pid} agent={child} depth={depth + 1} />
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
