import os from 'os';
import path from 'path';
import fs from 'fs';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export interface SessionEntry {
  sessionId: string;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  totalSessions: number;
  totalMessages: number;
  lastActivity: string;
  branches: string[];
  sessions: SessionEntry[];
  hasMemory: boolean;
  diskSize: number;
}

function decodeDirName(dirName: string): string {
  return dirName.replace(/^-/, '/').replace(/-/g, '/');
}

function extractProjectName(decodedPath: string): string {
  const parts = decodedPath.split('/').filter(Boolean);
  // Return last meaningful segment (usually repo name)
  return parts[parts.length - 1] || decodedPath;
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // ignore permission errors
  }
  return size;
}

function readSessionsIndex(projectDir: string): SessionEntry[] | null {
  const indexPath = path.join(projectDir, 'sessions-index.json');
  if (!fs.existsSync(indexPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (data && Array.isArray(data.entries)) {
      return data.entries.map((e: Record<string, unknown>) => ({
        sessionId: String(e.sessionId || ''),
        firstPrompt: String(e.firstPrompt || 'No prompt'),
        messageCount: Number(e.messageCount || 0),
        created: String(e.created || ''),
        modified: String(e.modified || ''),
        gitBranch: String(e.gitBranch || ''),
        projectPath: String(e.projectPath || ''),
        isSidechain: Boolean(e.isSidechain),
      }));
    }
    // Handle old format where entries is the root array
    if (Array.isArray(data)) {
      return data.map((e: Record<string, unknown>) => ({
        sessionId: String(e.sessionId || ''),
        firstPrompt: String(e.firstPrompt || 'No prompt'),
        messageCount: Number(e.messageCount || 0),
        created: String(e.created || e.startTime || ''),
        modified: String(e.modified || e.lastActivity || ''),
        gitBranch: String(e.gitBranch || ''),
        projectPath: String(e.projectPath || ''),
        isSidechain: Boolean(e.isSidechain),
      }));
    }
  } catch {
    // fall through
  }
  return null;
}

function scanSessionFiles(projectDir: string): SessionEntry[] {
  try {
    return fs
      .readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const filePath = path.join(projectDir, f);
        const stat = fs.statSync(filePath);
        return {
          sessionId: f.replace('.jsonl', ''),
          firstPrompt: 'No prompt',
          messageCount: 0,
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString(),
          gitBranch: '',
          projectPath: '',
          isSidechain: false,
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } catch {
    return [];
  }
}

export function getAllProjects(): ProjectInfo[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.' || entry.name === '..') continue;

    const projectDir = path.join(PROJECTS_DIR, entry.name);
    const decodedPath = decodeDirName(entry.name);
    const name = extractProjectName(decodedPath);

    // Get sessions from index or fallback to file scanning
    let sessions = readSessionsIndex(projectDir);
    if (!sessions) {
      sessions = scanSessionFiles(projectDir);
    }

    // Sort sessions by modified date (most recent first)
    sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    // Compute aggregates
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const branches = [...new Set(sessions.map(s => s.gitBranch).filter(Boolean))];
    const lastActivity = sessions.length > 0 ? sessions[0].modified : '';
    const hasMemory = fs.existsSync(path.join(projectDir, 'memory'));
    const diskSize = getDirSize(projectDir);

    projects.push({
      id: entry.name,
      name,
      path: decodedPath,
      totalSessions: sessions.length,
      totalMessages,
      lastActivity,
      branches,
      sessions,
      hasMemory,
      diskSize,
    });
  }

  // Sort by last activity (most recent first)
  projects.sort((a, b) => {
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  return projects;
}
