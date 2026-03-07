import { useState, useEffect } from 'react';
import { getCostBreakdown } from '../hooks/useAgents';
import type { ModelCostBreakdown } from '../hooks/useAgents';

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4': '#e8a23e',
  'claude-sonnet-4': '#58a6ff',
  'claude-sonnet-3-5': '#bc8cff',
  'claude-haiku-3-5': '#56d4dd',
};

function getModelColor(model: string): string {
  return MODEL_COLORS[model] || '#6e7681';
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function CostBreakdown() {
  const [data, setData] = useState<{
    models: ModelCostBreakdown[];
    totalCost: number;
    totalSessions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getCostBreakdown();
        if (!cancelled) {
          setData(result);
          // Trigger bar animation after render
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!cancelled) setLoaded(true);
            });
          });
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-white/30 text-sm">Loading cost breakdown...</div>
      </div>
    );
  }

  if (!data || data.models.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-white/20 text-sm">
          No cost data available. Start using Claude to see spending by model.
        </div>
      </div>
    );
  }

  const mostExpensive = data.models[0]; // already sorted by cost desc

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bar chart */}
      <div className="card card-glow p-6">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-5">
          Spending by Model
        </h3>
        <div className="space-y-3">
          {data.models.map(model => {
            const pct = data.totalCost > 0
              ? (model.totalCost / data.totalCost) * 100
              : 0;
            const color = getModelColor(model.model);

            return (
              <div key={model.model}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[13px] text-white/70 font-medium">
                      {model.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-white/40">
                      {pct.toFixed(1)}%
                    </span>
                    <span className="metric-value text-[13px]" style={{ color }}>
                      {formatCost(model.totalCost)}
                    </span>
                  </div>
                </div>
                <div className="h-5 rounded bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: loaded ? `${Math.max(pct, 0.5)}%` : '0%',
                      backgroundColor: color,
                      opacity: 0.7,
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">
            Total Spend
          </div>
          <div className="metric-value text-2xl text-accent">
            {formatCost(data.totalCost)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">
            Total Sessions
          </div>
          <div className="metric-value text-2xl text-data-purple">
            {data.totalSessions}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white/30 mb-1">
            Most Expensive
          </div>
          <div
            className="metric-value text-2xl"
            style={{ color: getModelColor(mostExpensive.model) }}
          >
            {mostExpensive.displayName}
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="card card-glow overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle/60">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-white/30">
            Detailed Breakdown
          </h3>
        </div>

        {/* Table header */}
        <div className="px-5 py-2 flex items-center text-[10px] font-mono uppercase tracking-wider text-white/20 bg-surface-1/30">
          <span className="flex-1">Model</span>
          <span className="w-20 text-right">Input</span>
          <span className="w-20 text-right">Output</span>
          <span className="w-20 text-right">Cache W</span>
          <span className="w-20 text-right">Cache R</span>
          <span className="w-20 text-right">Cost</span>
          <span className="w-14 text-right">%</span>
          <span className="w-16 text-right">Sessions</span>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border-subtle/30">
          {data.models.map(model => {
            const pct = data.totalCost > 0
              ? (model.totalCost / data.totalCost) * 100
              : 0;
            const color = getModelColor(model.model);

            return (
              <div
                key={model.model}
                className="px-5 py-3 flex items-center text-[12px] hover:bg-surface-2/30 transition-colors"
              >
                <div className="flex-1 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white/70 font-medium">
                    {model.displayName}
                  </span>
                </div>
                <span className="w-20 text-right font-mono text-white/40">
                  {formatTokens(model.inputTokens)}
                </span>
                <span className="w-20 text-right font-mono text-white/40">
                  {formatTokens(model.outputTokens)}
                </span>
                <span className="w-20 text-right font-mono text-white/40">
                  {formatTokens(model.cacheWriteTokens)}
                </span>
                <span className="w-20 text-right font-mono text-white/40">
                  {formatTokens(model.cacheReadTokens)}
                </span>
                <span className="w-20 text-right metric-value" style={{ color }}>
                  {formatCost(model.totalCost)}
                </span>
                <span className="w-14 text-right font-mono text-white/30">
                  {pct.toFixed(1)}%
                </span>
                <span className="w-16 text-right font-mono text-white/40">
                  {model.sessionCount}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
