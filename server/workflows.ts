import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  dependsOn: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
}

export interface StepStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  pid?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  output?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  stepStatuses: Record<string, StepStatus>;
}

const WORKFLOWS_DIR = path.join(os.homedir(), '.claude', 'claude-agents-monitor');
const WORKFLOWS_FILE = path.join(WORKFLOWS_DIR, 'workflows.json');

function loadWorkflows(): Map<string, Workflow> {
  try {
    const data = fs.readFileSync(WORKFLOWS_FILE, 'utf-8');
    return new Map(JSON.parse(data));
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      // First run — no file yet, start empty
    } else {
      console.warn('Warning: Failed to load workflows from disk, starting with empty state:', err);
    }
    return new Map();
  }
}

function saveWorkflows(): void {
  try {
    fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
    fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(Array.from(workflows.entries()), null, 2));
  } catch (err) {
    console.warn('Warning: Failed to save workflows to disk:', err);
  }
}

const workflows = loadWorkflows();
const runs = new Map<string, WorkflowRun>();
const runProcesses = new Map<string, Map<string, ChildProcess>>();

export function createWorkflow(
  data: Omit<Workflow, 'id' | 'createdAt'>
): Workflow {
  const workflow: Workflow = {
    ...data,
    id: randomUUID(),
    createdAt: Date.now(),
  };
  workflows.set(workflow.id, workflow);
  saveWorkflows();
  return workflow;
}

export function getWorkflows(): Workflow[] {
  return Array.from(workflows.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function getWorkflow(id: string): Workflow | undefined {
  return workflows.get(id);
}

export function deleteWorkflow(id: string): boolean {
  const result = workflows.delete(id);
  if (result) saveWorkflows();
  return result;
}

export function exportWorkflow(id: string): Workflow | null {
  return workflows.get(id) || null;
}

export function importWorkflow(data: {
  name: string;
  description: string;
  steps: Array<{ name: string; prompt: string; cwd: string; dependsOn: string[] }>;
}): Workflow {
  const workflow: Workflow = {
    id: randomUUID(),
    name: data.name,
    description: data.description,
    steps: data.steps.map(s => ({
      id: randomUUID(),
      name: s.name,
      prompt: s.prompt,
      cwd: s.cwd,
      dependsOn: s.dependsOn,
    })),
    createdAt: Date.now(),
  };
  workflows.set(workflow.id, workflow);
  saveWorkflows();
  return workflow;
}

export function startWorkflowRun(workflowId: string): WorkflowRun | null {
  const workflow = workflows.get(workflowId);
  if (!workflow) return null;

  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId,
    workflowName: workflow.name,
    status: 'running',
    startedAt: Date.now(),
    stepStatuses: {},
  };

  for (const step of workflow.steps) {
    run.stepStatuses[step.id] = { status: 'pending' };
  }

  runs.set(run.id, run);
  runProcesses.set(run.id, new Map());

  executeWorkflow(workflow, run);

  return run;
}

async function executeWorkflow(
  workflow: Workflow,
  run: WorkflowRun
): Promise<void> {
  const completed = new Set<string>();

  while (run.status === 'running') {
    const ready = workflow.steps.filter(step => {
      if (run.stepStatuses[step.id].status !== 'pending') return false;
      return step.dependsOn.every(dep => completed.has(dep));
    });

    if (ready.length === 0) {
      const hasPending = workflow.steps.some(
        s => run.stepStatuses[s.id].status === 'pending'
      );
      const hasRunning = workflow.steps.some(
        s => run.stepStatuses[s.id].status === 'running'
      );

      if (!hasPending && !hasRunning) {
        run.status = 'completed';
        run.completedAt = Date.now();
        saveWorkflows();
      }
      break;
    }

    const promises = ready.map(step => executeStep(step, run, workflow));
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < ready.length; i++) {
      const step = ready[i];
      const result = results[i];

      if (result.status === 'fulfilled' && result.value) {
        completed.add(step.id);
      } else {
        run.status = 'failed';
        run.completedAt = Date.now();
        for (const s of workflow.steps) {
          if (run.stepStatuses[s.id].status === 'pending') {
            run.stepStatuses[s.id].status = 'skipped';
          }
        }
        saveWorkflows();
        return;
      }
    }
  }
}

const MAX_OUTPUT_BYTES = 50_000; // 50 KB per step

const MAX_CONTEXT_PER_DEP = 10_000; // 10 KB of output per dependency

function buildPromptWithContext(
  step: WorkflowStep,
  run: WorkflowRun,
  workflow: Workflow
): string {
  if (step.dependsOn.length === 0) return step.prompt;

  const contextParts: string[] = [];
  for (const depId of step.dependsOn) {
    const depStatus = run.stepStatuses[depId];
    const depStep = workflow.steps.find(s => s.id === depId);
    if (!depStatus?.output || !depStep) continue;
    const trimmed = depStatus.output.slice(0, MAX_CONTEXT_PER_DEP);
    contextParts.push(`--- Output from "${depStep.name}" ---\n${trimmed}`);
  }

  if (contextParts.length === 0) return step.prompt;
  return `Context from previous steps:\n\n${contextParts.join('\n\n')}\n\n---\n\n${step.prompt}`;
}

function executeStep(
  step: WorkflowStep,
  run: WorkflowRun,
  workflow: Workflow
): Promise<boolean> {
  return new Promise(resolve => {
    run.stepStatuses[step.id] = { status: 'running', startedAt: Date.now() };

    try {
      const prompt = buildPromptWithContext(step, run, workflow);
      const child = spawn('claude', ['-p', prompt], {
        cwd: step.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      run.stepStatuses[step.id].pid = child.pid;

      const processes = runProcesses.get(run.id);
      if (processes) processes.set(step.id, child);

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const collectChunk = (chunk: Buffer) => {
        if (totalBytes < MAX_OUTPUT_BYTES) {
          chunks.push(chunk);
          totalBytes += chunk.length;
        }
      };

      child.stdout?.on('data', collectChunk);
      child.stderr?.on('data', collectChunk);

      child.on('close', code => {
        const output = Buffer.concat(chunks).toString('utf-8').slice(0, MAX_OUTPUT_BYTES);
        run.stepStatuses[step.id].status =
          code === 0 ? 'completed' : 'failed';
        run.stepStatuses[step.id].completedAt = Date.now();
        run.stepStatuses[step.id].output = output;
        if (code !== 0) {
          run.stepStatuses[step.id].error = `Exit code: ${code}`;
        }
        resolve(code === 0);
      });

      child.on('error', err => {
        run.stepStatuses[step.id].status = 'failed';
        run.stepStatuses[step.id].completedAt = Date.now();
        run.stepStatuses[step.id].error = err.message;
        resolve(false);
      });
    } catch (err: unknown) {
      run.stepStatuses[step.id].status = 'failed';
      run.stepStatuses[step.id].error =
        err instanceof Error ? err.message : 'Unknown error';
      resolve(false);
    }
  });
}

export function getRuns(): WorkflowRun[] {
  return Array.from(runs.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function getRun(id: string): WorkflowRun | undefined {
  return runs.get(id);
}

// ─── Workflow Templates ─────────────────────────────────

interface WorkflowTemplateStep {
  name: string;
  prompt: string;
  cwd: string;
  dependsOn: string[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowTemplateStep[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review codebase for bugs, security issues, and suggest improvements.',
    category: 'quality',
    steps: [
      {
        name: 'Review code for bugs and issues',
        prompt: 'Review the codebase for bugs, security issues, and code quality problems. Provide a detailed report.',
        cwd: '{{cwd}}',
        dependsOn: [],
      },
      {
        name: 'Suggest improvements',
        prompt: 'Based on the code review, suggest specific improvements with code examples.',
        cwd: '{{cwd}}',
        dependsOn: ['step-0'],
      },
    ],
  },
  {
    id: 'refactor-test',
    name: 'Refactor + Test',
    description: 'Refactor code for readability, write tests, and verify they pass.',
    category: 'quality',
    steps: [
      {
        name: 'Refactor code',
        prompt: 'Refactor the code to improve readability, reduce duplication, and follow best practices. Make the changes.',
        cwd: '{{cwd}}',
        dependsOn: [],
      },
      {
        name: 'Write tests',
        prompt: 'Write comprehensive tests for the refactored code. Ensure good coverage of edge cases.',
        cwd: '{{cwd}}',
        dependsOn: ['step-0'],
      },
      {
        name: 'Run tests',
        prompt: 'Run all tests and fix any failures.',
        cwd: '{{cwd}}',
        dependsOn: ['step-1'],
      },
    ],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Generate comprehensive project documentation.',
    category: 'docs',
    steps: [
      {
        name: 'Generate docs',
        prompt: 'Generate comprehensive documentation for this project including README, API docs, and inline comments where missing.',
        cwd: '{{cwd}}',
        dependsOn: [],
      },
    ],
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Diagnose and fix bugs with regression tests.',
    category: 'fix',
    steps: [
      {
        name: 'Diagnose bug',
        prompt: 'Analyze the codebase to identify bugs. Check test failures, error logs, and code patterns that could cause issues.',
        cwd: '{{cwd}}',
        dependsOn: [],
      },
      {
        name: 'Fix bugs',
        prompt: 'Fix the identified bugs. Write regression tests for each fix.',
        cwd: '{{cwd}}',
        dependsOn: ['step-0'],
      },
    ],
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Scan for vulnerabilities and fix security issues.',
    category: 'quality',
    steps: [
      {
        name: 'Scan for vulnerabilities',
        prompt: 'Perform a security audit: check for injection vulnerabilities, auth issues, exposed secrets, and OWASP top 10 risks.',
        cwd: '{{cwd}}',
        dependsOn: [],
      },
      {
        name: 'Fix security issues',
        prompt: 'Fix the identified security vulnerabilities and add security tests.',
        cwd: '{{cwd}}',
        dependsOn: ['step-0'],
      },
    ],
  },
];

export function getWorkflowTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES;
}

export function createWorkflowFromTemplate(
  templateId: string,
  cwd: string
): Workflow | null {
  const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  // Generate real step IDs and map placeholder dependsOn references
  const stepIds = template.steps.map(() => randomUUID());

  const steps: Array<{ id: string; name: string; prompt: string; cwd: string; dependsOn: string[] }> = template.steps.map((s, i) => ({
    id: stepIds[i],
    name: s.name,
    prompt: s.prompt,
    cwd: s.cwd.replace(/\{\{cwd\}\}/g, cwd),
    dependsOn: s.dependsOn.map(dep => {
      const depIndex = parseInt(dep.replace('step-', ''));
      return stepIds[depIndex];
    }),
  }));

  return createWorkflow({
    name: template.name,
    description: template.description,
    steps,
  });
}

export function cancelRun(id: string): boolean {
  const run = runs.get(id);
  if (!run || run.status !== 'running') return false;

  run.status = 'cancelled';
  run.completedAt = Date.now();

  const processes = runProcesses.get(id);
  if (processes) {
    for (const [stepId, child] of processes) {
      try {
        child.kill('SIGTERM');
        if (run.stepStatuses[stepId].status === 'running') {
          run.stepStatuses[stepId].status = 'failed';
          run.stepStatuses[stepId].error = 'Cancelled';
          run.stepStatuses[stepId].completedAt = Date.now();
        }
      } catch {
        // process may already be dead
      }
    }
  }

  for (const status of Object.values(run.stepStatuses)) {
    if (status.status === 'pending') {
      status.status = 'skipped';
    }
  }

  return true;
}
