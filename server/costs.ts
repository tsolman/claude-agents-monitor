import os from 'os';
import path from 'path';
import fs from 'fs';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalCost: number;
}

// Per-million-token pricing
const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4-6':   { input: 15,   output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4':     { input: 15,   output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6': { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4':   { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-3-5': { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-3-5':  { input: 0.80, output: 4,   cacheWrite: 1.00,  cacheRead: 0.08 },
};

const DEFAULT_PRICING = PRICING['claude-sonnet-4'];

// Cache: filePath -> { mtime, cost }
const costCache = new Map<string, { mtime: number; cost: CostInfo }>();

function normalizeModel(model: string): string {
  // "claude-sonnet-4-20250514" -> "claude-sonnet-4"
  return model.replace(/-\d{8}$/, '');
}

function getPricing(model: string | undefined) {
  if (!model) return DEFAULT_PRICING;
  const normalized = normalizeModel(model);
  return PRICING[normalized] || DEFAULT_PRICING;
}

function cwdToProjectPath(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

function findLatestSessionFile(projectDir: string): string | null {
  if (!fs.existsSync(projectDir)) return null;

  const files = fs
    .readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      path: path.join(projectDir, f),
      mtime: fs.statSync(path.join(projectDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

function parseSessionCost(filePath: string): CostInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const seen = new Set<string>();
  let directCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheWriteTokens = 0;
  let cacheReadTokens = 0;
  let lastModel: string | undefined;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // Dedup: skip duplicate message entries
      const msgId = parsed.message?.id;
      const reqId = parsed.requestId;
      if (msgId && reqId) {
        const key = `${msgId}:${reqId}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }

      if (parsed.type !== 'assistant') continue;

      // Forward-compatible: use costUSD if available
      if (typeof parsed.costUSD === 'number') directCost += parsed.costUSD;

      // Usage can be at top level or inside message
      const usage = parsed.message?.usage || parsed.usage;
      if (!usage) continue;

      // Track model for pricing
      const model = parsed.message?.model || parsed.model;
      if (model) lastModel = model;

      inputTokens += usage.input_tokens || 0;
      outputTokens += usage.output_tokens || 0;
      cacheWriteTokens += usage.cache_creation_input_tokens || 0;
      cacheReadTokens += usage.cache_read_input_tokens || 0;
    } catch {
      // skip malformed lines
    }
  }

  // Prefer direct costUSD if available, else compute from tokens
  let totalCost: number;
  if (directCost > 0) {
    totalCost = directCost;
  } else {
    const pricing = getPricing(lastModel);
    totalCost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      (cacheWriteTokens / 1_000_000) * pricing.cacheWrite +
      (cacheReadTokens / 1_000_000) * pricing.cacheRead;
  }

  return {
    inputTokens,
    outputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    totalCost: Math.round(totalCost * 10000) / 10000, // 4 decimal places
  };
}

export function getSessionCost(sessionFilePath: string): CostInfo | null {
  if (!fs.existsSync(sessionFilePath)) return null;

  try {
    const stat = fs.statSync(sessionFilePath);
    const mtime = stat.mtime.getTime();

    // Check cache
    const cached = costCache.get(sessionFilePath);
    if (cached && cached.mtime === mtime) {
      return cached.cost;
    }

    const cost = parseSessionCost(sessionFilePath);
    if (cost.inputTokens === 0 && cost.outputTokens === 0) return null;

    costCache.set(sessionFilePath, { mtime, cost });
    return cost;
  } catch {
    return null;
  }
}

// ─── Cost breakdown by model ──────────────────────────────

export interface ModelCostBreakdown {
  model: string;
  displayName: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  sessionCount: number;
}

export interface CostBreakdownResult {
  models: ModelCostBreakdown[];
  totalCost: number;
  totalSessions: number;
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus-4-6': 'Opus 4.6',
  'claude-opus-4': 'Opus 4',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-sonnet-4': 'Sonnet 4',
  'claude-sonnet-3-5': 'Sonnet 3.5',
  'claude-haiku-3-5': 'Haiku 3.5',
};

let breakdownCache: { timestamp: number; result: CostBreakdownResult } | null = null;
const BREAKDOWN_CACHE_TTL = 60_000; // 60 seconds

function parseSessionByModel(filePath: string): Map<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const seen = new Set<string>();
  const modelUsage = new Map<string, { input: number; output: number; cacheWrite: number; cacheRead: number }>();
  let lastModel = 'unknown';

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // Dedup: skip duplicate message entries
      const msgId = parsed.message?.id;
      const reqId = parsed.requestId;
      if (msgId && reqId) {
        const key = `${msgId}:${reqId}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }

      if (parsed.type !== 'assistant') continue;

      const usage = parsed.message?.usage || parsed.usage;
      if (!usage) continue;

      const rawModel = parsed.message?.model || parsed.model;
      if (rawModel) lastModel = normalizeModel(rawModel);

      const existing = modelUsage.get(lastModel) || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
      existing.input += usage.input_tokens || 0;
      existing.output += usage.output_tokens || 0;
      existing.cacheWrite += usage.cache_creation_input_tokens || 0;
      existing.cacheRead += usage.cache_read_input_tokens || 0;
      modelUsage.set(lastModel, existing);
    } catch {
      // skip malformed lines
    }
  }

  return modelUsage;
}

export function getCostBreakdownByModel(): CostBreakdownResult {
  const now = Date.now();
  if (breakdownCache && (now - breakdownCache.timestamp) < BREAKDOWN_CACHE_TTL) {
    return breakdownCache.result;
  }

  const projectsDir = path.join(CLAUDE_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return { models: [], totalCost: 0, totalSessions: 0 };
  }

  const aggregate = new Map<string, { input: number; output: number; cacheWrite: number; cacheRead: number; sessions: Set<string> }>();
  let totalSessions = 0;

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const projectDir = path.join(projectsDir, dir.name);

    let jsonlFiles: string[];
    try {
      jsonlFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of jsonlFiles) {
      const filePath = path.join(projectDir, file);
      totalSessions++;

      try {
        const modelUsage = parseSessionByModel(filePath);
        for (const [model, usage] of modelUsage) {
          const existing = aggregate.get(model) || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, sessions: new Set<string>() };
          existing.input += usage.input;
          existing.output += usage.output;
          existing.cacheWrite += usage.cacheWrite;
          existing.cacheRead += usage.cacheRead;
          existing.sessions.add(filePath);
          aggregate.set(model, existing);
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  let totalCost = 0;
  const models: ModelCostBreakdown[] = [];

  for (const [model, data] of aggregate) {
    const pricing = getPricing(model === 'unknown' ? undefined : model);
    const cost =
      (data.input / 1_000_000) * pricing.input +
      (data.output / 1_000_000) * pricing.output +
      (data.cacheWrite / 1_000_000) * pricing.cacheWrite +
      (data.cacheRead / 1_000_000) * pricing.cacheRead;

    const roundedCost = Math.round(cost * 10000) / 10000;
    totalCost += roundedCost;

    models.push({
      model,
      displayName: MODEL_DISPLAY_NAMES[model] || model,
      inputTokens: data.input,
      outputTokens: data.output,
      cacheWriteTokens: data.cacheWrite,
      cacheReadTokens: data.cacheRead,
      totalCost: roundedCost,
      sessionCount: data.sessions.size,
    });
  }

  // Sort by cost descending
  models.sort((a, b) => b.totalCost - a.totalCost);

  const result: CostBreakdownResult = {
    models,
    totalCost: Math.round(totalCost * 10000) / 10000,
    totalSessions,
  };

  breakdownCache = { timestamp: now, result };
  return result;
}

export function getAgentCost(cwd: string): CostInfo | null {
  const projectPath = cwdToProjectPath(cwd);
  const projectDir = path.join(CLAUDE_DIR, 'projects', projectPath);
  const filePath = findLatestSessionFile(projectDir);

  if (!filePath) return null;

  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtime.getTime();

    // Check cache
    const cached = costCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.cost;
    }

    // Parse and cache
    const cost = parseSessionCost(filePath);
    costCache.set(filePath, { mtime, cost });
    return cost;
  } catch {
    return null;
  }
}
