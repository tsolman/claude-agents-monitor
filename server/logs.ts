import os from 'os';
import path from 'path';
import fs from 'fs';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export interface LogEntry {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sessionId: string;
}

export interface SessionInfo {
  sessionId: string;
  slug: string;
  startTime: string;
  lastActivity: string;
  messageCount: number;
}

function cwdToProjectPath(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

function readLastChunk(filePath: string, maxBytes = 100000): string[] {
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
  fs.readSync(fd, buffer, 0, buffer.length, start);
  fs.closeSync(fd);

  const content = buffer.toString('utf-8');
  const lines = content.split('\n');
  // First line might be partial if we didn't start at the beginning
  if (start > 0) lines.shift();
  return lines.filter(l => l.trim());
}

function extractTextContent(message: { content: unknown }): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('\n');
  }
  return '';
}

export function getSessionLogs(cwd: string, limit = 30): LogEntry[] {
  const projectPath = cwdToProjectPath(cwd);
  const projectDir = path.join(CLAUDE_DIR, 'projects', projectPath);

  if (!fs.existsSync(projectDir)) return [];

  const files = fs
    .readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(projectDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return [];

  // Read the most recent session file
  const latestFile = path.join(projectDir, files[0].name);
  const lines = readLastChunk(latestFile);

  const entries: LogEntry[] = [];

  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;
      if (!parsed.message) continue;

      const content = extractTextContent(parsed.message);
      if (!content.trim()) continue;

      entries.unshift({
        type: parsed.type,
        content: content.slice(0, 1000),
        timestamp: parsed.timestamp,
        sessionId: parsed.sessionId,
      });
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

export function getFullSessionLogs(
  cwd: string,
  options?: { search?: string; limit?: number }
): LogEntry[] {
  const limit = options?.limit ?? 200;
  const search = options?.search?.toLowerCase();

  const projectPath = cwdToProjectPath(cwd);
  const projectDir = path.join(CLAUDE_DIR, 'projects', projectPath);

  if (!fs.existsSync(projectDir)) return [];

  const files = fs
    .readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(projectDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return [];

  const latestFile = path.join(projectDir, files[0].name);
  const lines = readLastChunk(latestFile, 500000);

  const entries: LogEntry[] = [];

  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;
      if (!parsed.message) continue;

      const content = extractTextContent(parsed.message);
      if (!content.trim()) continue;

      const truncated = content.slice(0, 3000);

      if (search && !truncated.toLowerCase().includes(search)) continue;

      entries.unshift({
        type: parsed.type,
        content: truncated,
        timestamp: parsed.timestamp,
        sessionId: parsed.sessionId,
      });
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

export function getProjectSessions(cwd: string): SessionInfo[] {
  const projectPath = cwdToProjectPath(cwd);
  const projectDir = path.join(CLAUDE_DIR, 'projects', projectPath);

  if (!fs.existsSync(projectDir)) return [];

  // Try sessions-index.json first
  const indexPath = path.join(projectDir, 'sessions-index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (Array.isArray(index)) {
        return index.slice(0, 20).map((s: Record<string, unknown>) => ({
          sessionId: String(s.sessionId || ''),
          slug: String(s.slug || ''),
          startTime: String(s.startTime || ''),
          lastActivity: String(s.lastActivity || s.startTime || ''),
          messageCount: Number(s.messageCount || 0),
        }));
      }
    } catch {
      // fall through to file scanning
    }
  }

  // Fallback: scan JSONL files
  const files = fs
    .readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const filePath = path.join(projectDir, f);
      const stat = fs.statSync(filePath);
      return {
        sessionId: f.replace('.jsonl', ''),
        slug: '',
        startTime: stat.birthtime.toISOString(),
        lastActivity: stat.mtime.toISOString(),
        messageCount: 0,
        mtime: stat.mtime.getTime(),
      };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 20);

  return files.map(({ mtime: _, ...rest }) => rest);
}
