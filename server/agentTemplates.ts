import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface AgentTemplate {
  id: string;
  name: string;
  icon?: string;
  prompt: string;
  model?: string;
  cwd?: string;
  createdAt: number;
}

const TEMPLATES_DIR = path.join(os.homedir(), '.claude', 'claude-agents-monitor');
const TEMPLATES_FILE = path.join(TEMPLATES_DIR, 'agent-templates.json');

function ensureDir(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

function loadTemplates(): AgentTemplate[] {
  try {
    if (!fs.existsSync(TEMPLATES_FILE)) return [];
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTemplates(templates: AgentTemplate[]): void {
  ensureDir();
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

export function getAllTemplates(): AgentTemplate[] {
  return loadTemplates();
}

export function createTemplate(data: { name: string; prompt: string; icon?: string; model?: string; cwd?: string }): AgentTemplate {
  const templates = loadTemplates();
  const template: AgentTemplate = {
    id: crypto.randomUUID(),
    name: data.name,
    prompt: data.prompt,
    icon: data.icon,
    model: data.model,
    cwd: data.cwd,
    createdAt: Date.now(),
  };
  templates.push(template);
  saveTemplates(templates);
  return template;
}

export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates();
  const filtered = templates.filter(t => t.id !== id);
  if (filtered.length === templates.length) return false;
  saveTemplates(filtered);
  return true;
}

export function importOpcodeTemplate(opcodeConfig: {
  agent?: {
    name?: string;
    system_prompt?: string;
    default_task?: string;
    model?: string;
  };
}): AgentTemplate | null {
  const agent = opcodeConfig.agent;
  if (!agent) return null;

  const name = agent.name || 'Imported Template';
  const prompt = agent.default_task || agent.system_prompt || '';
  if (!prompt) return null;

  return createTemplate({
    name,
    prompt,
    model: agent.model,
  });
}
