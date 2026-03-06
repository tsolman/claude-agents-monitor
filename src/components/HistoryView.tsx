import { useState, useMemo } from 'react';
import type { HistoryEntry } from '../types';
import { Sparkline } from './Sparkline';

const RANGE_OPTIONS = [
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
] as const;

interface HistoryViewProps {
  history: HistoryEntry[];
}

export function HistoryView({ history }: HistoryViewProps) {
  const [range, setRange] = useState(30);

  const filteredHistory = useMemo(() => {
    const cutoff = Date.now() - range * 60 * 1000;
    return history.filter(h => h.timestamp >= cutoff);
  }, [history, range]);

  const rangeLabel = RANGE_OPTIONS.find(o => o.minutes === range)!.label;

  if (filteredHistory.length < 5) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
            Resource History
            <span className="text-white/25">{' '}&mdash; Last {rangeLabel}</span>
          </h2>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.minutes}
                onClick={() => setRange(opt.minutes)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-mono font-medium transition-colors cursor-pointer ${
                  range === opt.minutes
                    ? 'bg-accent-dim text-accent ring-1 ring-accent/30'
                    : 'bg-surface-2 text-white/25 hover:text-white/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6 h-8 w-8">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/5 border-t-data-blue/40" />
          </div>
          <h2 className="mb-2 text-sm font-medium text-white/40">
            Collecting data...
          </h2>
          <p className="font-mono text-[11px] text-white/20">
            History will appear after a few seconds of monitoring.
          </p>
        </div>
      </div>
    );
  }

  const agentCounts = filteredHistory.map(h => h.totalCount);
  const cpuValues = filteredHistory.map(h => h.totalCpu);
  const memValues = filteredHistory.map(h => h.totalMemory);

  const latest = filteredHistory[filteredHistory.length - 1];
  const oldest = filteredHistory[0];
  const durationMin = Math.round(
    (latest.timestamp - oldest.timestamp) / 60000
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
          Resource History
          <span className="text-white/25">{' '}&mdash; Last {rangeLabel}</span>
        </h2>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => setRange(opt.minutes)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-mono font-medium transition-colors cursor-pointer ${
                range === opt.minutes
                  ? 'bg-accent-dim text-accent ring-1 ring-accent/30'
                  : 'bg-surface-2 text-white/25 hover:text-white/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Large charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ChartCard title="Active Agents" color="#3fb950" borderColor="rgba(63, 185, 80, 0.15)">
          <Sparkline
            data={agentCounts}
            height={100}
            color="#3fb950"
            currentValue={String(latest.totalCount)}
          />
        </ChartCard>

        <ChartCard title="Total CPU" color="#58a6ff" borderColor="rgba(88, 166, 255, 0.15)">
          <Sparkline
            data={cpuValues}
            height={100}
            color="#58a6ff"
            currentValue={`${latest.totalCpu.toFixed(1)}%`}
          />
        </ChartCard>

        <ChartCard title="Total Memory" color="#bc8cff" borderColor="rgba(188, 140, 255, 0.15)">
          <Sparkline
            data={memValues}
            height={100}
            color="#bc8cff"
            currentValue={`${latest.totalMemory.toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      {/* Summary stats */}
      <div>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-white/20">
          Summary
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Peak Agents"
            value={String(Math.max(...agentCounts))}
            color="#3fb950"
          />
          <StatCard
            label="Peak CPU"
            value={`${Math.max(...cpuValues).toFixed(1)}%`}
            color="#58a6ff"
          />
          <StatCard
            label="Peak Memory"
            value={`${Math.max(...memValues).toFixed(1)}%`}
            color="#bc8cff"
          />
          <StatCard
            label="Avg CPU"
            value={`${(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1)}%`}
            color="#56d4dd"
          />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  color,
  borderColor,
  children,
}: {
  title: string;
  color: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card relative overflow-hidden p-5"
      style={{ borderColor }}
    >
      {/* Colored top accent line */}
      <div
        className="absolute left-3 right-3 top-0 h-[2px] rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />
      <h3
        className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: `${color}90` }}
      >
        {title}
      </h3>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: `linear-gradient(to bottom, ${color}40, transparent)` }}
      />
      <div className="text-[10px] font-medium uppercase tracking-widest text-white/20">
        {label}
      </div>
      <div className="metric-value mt-1.5 text-xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
