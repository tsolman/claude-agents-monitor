import { useState } from 'react';
import type { MonitorState, HistoryEntry } from '../types';
import { AgentCard } from './AgentCard';
import { Sparkline } from './Sparkline';
import { LaunchModal } from './LaunchModal';

interface DashboardProps {
  state: MonitorState | null;
  connected: boolean;
  history: HistoryEntry[];
}

export function Dashboard({ state, connected, history }: DashboardProps) {
  const [showLaunch, setShowLaunch] = useState(false);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="relative mb-6 h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/5 border-t-accent/60" />
          <div className="absolute inset-1.5 animate-spin rounded-full border border-white/5 border-t-accent/30" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="font-mono text-xs text-white/20">
          connecting to monitor...
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Metric cards row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard
          label="Agents"
          value={state.totalCount}
          sub={`${state.mainCount} main`}
          color="#e8a23e"
        />
        <MetricCard
          label="Subagents"
          value={state.subagentCount}
          color="#bc8cff"
        />
        <MetricCard
          label="CPU Total"
          value={`${state.totalCpu}%`}
          color="#58a6ff"
          warn={state.totalCpu > 80}
        />
        <MetricCard
          label="Memory"
          value={`${state.totalMemory}%`}
          color="#56d4dd"
          warn={state.totalMemory > 80}
        />
        <MetricCard
          label="Session Cost"
          value={state.totalCost > 0
            ? `$${state.totalCost < 0.01 ? state.totalCost.toFixed(4) : state.totalCost.toFixed(2)}`
            : '$0.00'}
          color="#3fb950"
        />
      </div>

      {/* Sparkline strip */}
      {history.length > 5 && (
        <div className="mb-8 grid grid-cols-3 gap-3 animate-fade-in-delay">
          <div className="card p-4">
            <Sparkline
              data={history.map(h => h.totalCount)}
              height={36}
              color="#3fb950"
              label="Agents"
              currentValue={String(state.totalCount)}
            />
          </div>
          <div className="card p-4">
            <Sparkline
              data={history.map(h => h.totalCpu)}
              height={36}
              color="#58a6ff"
              label="CPU"
              currentValue={`${state.totalCpu}%`}
            />
          </div>
          <div className="card p-4">
            <Sparkline
              data={history.map(h => h.totalMemory)}
              height={36}
              color="#bc8cff"
              label="Memory"
              currentValue={`${state.totalMemory}%`}
            />
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
            Active Agents
          </h2>
          <span className="rounded-full bg-accent-dim px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
            {state.totalCount}
          </span>
        </div>
        <button
          onClick={() => setShowLaunch(true)}
          className="group flex items-center gap-2 rounded-lg bg-accent-dim px-3.5 py-2 text-[12px] font-medium text-accent ring-1 ring-accent/15 transition-all hover:bg-accent-medium hover:ring-accent/25"
        >
          <span className="text-accent/60 transition-colors group-hover:text-accent">
            +
          </span>
          Launch Agent
        </button>
      </div>

      {/* Agent list */}
      {state.agents.length === 0 ? (
        <EmptyState onLaunch={() => setShowLaunch(true)} />
      ) : (
        <div className="space-y-3 stagger-in">
          {state.agents.map(agent => (
            <AgentCard key={agent.pid} agent={agent} />
          ))}
        </div>
      )}

      {showLaunch && <LaunchModal onClose={() => setShowLaunch(false)} />}
    </>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  warn?: boolean;
}) {
  return (
    <div className="card card-glow relative overflow-hidden p-4">
      {/* Shimmer accent line */}
      <div
        className="absolute left-0 top-0 h-full w-[2px] shimmer-bar"
        style={{ '--shimmer-color': `${color}40` } as React.CSSProperties}
      />
      <div className="text-[10px] font-medium uppercase tracking-widest text-white/25">
        {label}
      </div>
      <div
        className={`metric-value mt-1.5 text-2xl ${warn ? 'text-warn' : ''}`}
        style={warn ? undefined : { color, textShadow: `0 0 20px ${color}30` }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-white/20">{sub}</div>
      )}
    </div>
  );
}

function EmptyState({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center">
      <pre className="mb-6 font-mono text-[10px] leading-relaxed text-white/10">
{`    ___  ___
   / _ \\/ _ \\
  | |_| |  _/
   \\___/|_|
`}
      </pre>
      <h2 className="mb-2 text-sm font-medium text-white/40">
        No active agents detected
      </h2>
      <p className="mb-6 max-w-sm text-[12px] leading-relaxed text-white/20">
        Start a Claude Code session in any terminal, or launch one from here.
        The monitor scans for processes every 2 seconds.
      </p>
      <div className="mb-6 rounded-lg bg-surface-1 px-4 py-2.5 ring-1 ring-border-subtle">
        <code className="font-mono text-[11px] text-accent/60">
          $ claude "help me fix this bug"
        </code>
      </div>
      <button
        onClick={onLaunch}
        className="rounded-lg bg-accent-dim px-4 py-2 text-[12px] font-medium text-accent ring-1 ring-accent/15 transition-all hover:bg-accent-medium"
      >
        Launch your first agent
      </button>
    </div>
  );
}
