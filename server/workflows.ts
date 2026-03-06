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

    const promises = ready.map(step => executeStep(step, run));
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

function executeStep(
  step: WorkflowStep,
  run: WorkflowRun
): Promise<boolean> {
  return new Promise(resolve => {
    run.stepStatuses[step.id] = { status: 'running', startedAt: Date.now() };

    try {
      const child = spawn('claude', ['-p', step.prompt], {
        cwd: step.cwd,
        stdio: 'ignore',
      });

      run.stepStatuses[step.id].pid = child.pid;

      const processes = runProcesses.get(run.id);
      if (processes) processes.set(step.id, child);

      child.on('close', code => {
        run.stepStatuses[step.id].status =
          code === 0 ? 'completed' : 'failed';
        run.stepStatuses[step.id].completedAt = Date.now();
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
