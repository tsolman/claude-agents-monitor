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
  'claude-opus-4':     { input: 15,   output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
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

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheWriteTokens = 0;
  let cacheReadTokens = 0;
  let lastModel: string | undefined;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type !== 'assistant') continue;

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

  const pricing = getPricing(lastModel);
  const totalCost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWrite +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead;

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
