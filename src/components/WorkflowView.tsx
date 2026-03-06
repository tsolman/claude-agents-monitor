import { useState, useEffect, useCallback } from 'react';
import type { Workflow, WorkflowRun, WorkflowStep } from '../types';
import {
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
  cancelWorkflowRun,
} from '../hooks/useAgents';
import { ConfirmDialog } from './ConfirmDialog';

export function WorkflowView() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [showEditor, setShowEditor] = useState(false);

  const refresh = useCallback(async () => {
    const [wf, rn] = await Promise.all([getWorkflows(), getWorkflowRuns()]);
    setWorkflows(wf.workflows);
    setRuns(rn.runs);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRun = async (id: string) => {
    await runWorkflow(id);
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteWorkflow(id);
    refresh();
  };

  const handleCancel = async (id: string) => {
    await cancelWorkflowRun(id);
    refresh();
  };

  const handleCreate = async (data: Omit<Workflow, 'id' | 'createdAt'>) => {
    await createWorkflow(data);
    setShowEditor(false);
    refresh();
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Workflows section */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
            Workflows
          </h2>
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="group flex items-center gap-2 rounded-lg bg-accent-dim px-3.5 py-2 text-[12px] font-medium text-accent ring-1 ring-accent/15 transition-all hover:bg-accent-medium hover:ring-accent/25"
          >
            {showEditor ? (
              'Cancel'
            ) : (
              <>
                <span className="text-accent/60 transition-colors group-hover:text-accent">
                  +
                </span>
                New Workflow
              </>
            )}
          </button>
        </div>

        {showEditor && (
          <WorkflowEditor
            onSave={handleCreate}
            onCancel={() => setShowEditor(false)}
          />
        )}

        {workflows.length === 0 && !showEditor ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 font-mono text-lg text-white/8">
              {'{ }'}
            </div>
            <h3 className="mb-2 text-sm font-medium text-white/35">
              No workflows yet
            </h3>
            <p className="mb-5 max-w-sm text-[12px] text-white/18">
              Create a workflow to orchestrate multiple Claude agents in
              sequence or parallel.
            </p>
            <button
              onClick={() => setShowEditor(true)}
              className="rounded-lg bg-surface-3 px-4 py-2 text-[12px] font-medium text-white/40 ring-1 ring-border transition-all hover:bg-surface-4 hover:text-white/60"
            >
              Create your first workflow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map(wf => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onRun={() => handleRun(wf.id)}
                onDelete={() => handleDelete(wf.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Runs section */}
      {runs.length > 0 && (
        <div>
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-widest text-white/30">
            Recent Runs
          </h2>
          <div className="space-y-3">
            {runs.map(run => (
              <RunCard
                key={run.id}
                run={run}
                onCancel={() => handleCancel(run.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onRun,
  onDelete,
}: {
  workflow: Workflow;
  onRun: () => void;
  onDelete: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="card card-glow p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-semibold text-white/80">
            {workflow.name}
          </h3>
          {workflow.description && (
            <p className="mt-1 text-[12px] text-white/25">
              {workflow.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {workflow.steps.map((step, i) => (
              <span key={step.id} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="font-mono text-[10px] text-white/10">
                    {step.dependsOn.length > 0 ? '>' : '|'}
                  </span>
                )}
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[10px] text-white/40 ring-1 ring-border-subtle">
                  {step.name}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRun}
            className="rounded-lg bg-live-dim px-3 py-1.5 font-mono text-[11px] font-medium text-live ring-1 ring-live/15 transition-all hover:bg-live/15"
          >
            RUN
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg px-3 py-1.5 font-mono text-[11px] font-medium text-white/15 transition-all hover:bg-danger-dim hover:text-danger"
          >
            DEL
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Workflow"
        message={`Delete '${workflow.name}'? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

function RunCard({
  run,
  onCancel,
}: {
  run: WorkflowRun;
  onCancel: () => void;
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const statusConfig: Record<string, { color: string; bg: string }> = {
    running: { color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.1)' },
    completed: { color: '#3fb950', bg: 'rgba(63, 185, 80, 0.1)' },
    failed: { color: '#f85149', bg: 'rgba(248, 81, 73, 0.1)' },
    cancelled: { color: '#6e7681', bg: 'rgba(110, 118, 129, 0.1)' },
  };

  const config = statusConfig[run.status] || statusConfig.cancelled;

  const stepEntries = Object.entries(run.stepStatuses);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: config.color, background: config.bg }}
          >
            {run.status}
          </span>
          <span className="text-[13px] font-medium text-white/50">
            {run.workflowName}
          </span>
          <span className="font-mono text-[10px] text-white/15">
            {new Date(run.startedAt).toLocaleTimeString()}
          </span>
        </div>
        {run.status === 'running' && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="rounded-lg px-3 py-1 font-mono text-[10px] font-medium text-white/20 transition-all hover:bg-danger-dim hover:text-danger"
          >
            CANCEL
          </button>
        )}
      </div>

      {/* Step progress bar */}
      <div className="flex gap-0.5 px-5">
        {stepEntries.map(([stepId, status]) => {
          const stepConfig: Record<string, string> = {
            completed: '#3fb950',
            running: '#58a6ff',
            failed: '#f85149',
            pending: 'rgba(255,255,255,0.05)',
            skipped: 'rgba(255,255,255,0.03)',
          };
          return (
            <div
              key={stepId}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                status.status === 'running' ? 'animate-glow-pulse' : ''
              }`}
              style={{ background: stepConfig[status.status] || stepConfig.pending }}
            />
          );
        })}
      </div>

      {/* Step details */}
      <div className="px-5 py-3">
        {stepEntries.map(([stepId, status]) => {
          const dotColors: Record<string, string> = {
            completed: '#3fb950',
            running: '#58a6ff',
            failed: '#f85149',
            pending: '#252b3b',
            skipped: '#1a1f2b',
          };
          return (
            <div
              key={stepId}
              className="flex items-center gap-2 py-0.5 font-mono text-[10px]"
            >
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: dotColors[status.status] }}
              />
              <span className="text-white/25">{stepId.slice(0, 8)}</span>
              <span className="text-white/12">{status.status}</span>
              {status.error && (
                <span className="text-danger/60">{status.error}</span>
              )}
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Run"
        message={`Cancel the running workflow '${run.workflowName}'?`}
        confirmLabel="Cancel Run"
        confirmVariant="warning"
        onConfirm={() => {
          setShowCancelConfirm(false);
          onCancel();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}

function WorkflowEditor({
  onSave,
  onCancel,
}: {
  onSave: (data: Omit<Workflow, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: crypto.randomUUID(), name: 'Step 1', prompt: '', cwd: '', dependsOn: [] },
  ]);

  const addStep = () => {
    setSteps(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Step ${prev.length + 1}`,
        prompt: '',
        cwd: '',
        dependsOn: [],
      },
    ]);
  };

  const updateStep = (
    index: number,
    field: keyof WorkflowStep,
    value: string | string[]
  ) => {
    setSteps(prev =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (steps.some(s => !s.prompt.trim() || !s.cwd.trim())) return;
    onSave({ name, description, steps });
  };

  return (
    <div className="card mb-6 overflow-hidden border-accent/15">
      <div className="border-b border-border-subtle px-6 py-4">
        <h3 className="text-[13px] font-semibold text-white/70">
          New Workflow
        </h3>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-white/25">
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My workflow"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-white/25">
              Description
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="input-field"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/25">
              Steps
            </span>
            <button
              onClick={addStep}
              className="font-mono text-[10px] font-medium text-accent/60 transition-colors hover:text-accent"
            >
              + add step
            </button>
          </div>

          {steps.map((step, i) => (
            <div
              key={step.id}
              className="space-y-2.5 rounded-lg bg-surface-1 p-4 ring-1 ring-border-subtle"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-3 font-mono text-[9px] text-white/25">
                    {i + 1}
                  </span>
                  <input
                    value={step.name}
                    onChange={e => updateStep(i, 'name', e.target.value)}
                    className="rounded border-0 bg-transparent px-1 py-0.5 text-[12px] font-medium text-white/60 outline-none focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(i)}
                    className="font-mono text-[10px] text-white/15 transition-colors hover:text-danger"
                  >
                    remove
                  </button>
                )}
              </div>
              <input
                value={step.cwd}
                onChange={e => updateStep(i, 'cwd', e.target.value)}
                placeholder="/path/to/project"
                className="input-field font-mono text-[11px]"
              />
              <textarea
                value={step.prompt}
                onChange={e => updateStep(i, 'prompt', e.target.value)}
                placeholder="What should this agent do?"
                rows={2}
                className="input-field resize-none text-[11px]"
              />
              {i > 0 && steps.slice(0, i).length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-widest text-white/15">
                    Depends on
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {steps.slice(0, i).map(prevStep => {
                      const checked = step.dependsOn.includes(prevStep.id);
                      return (
                        <button
                          key={prevStep.id}
                          onClick={() => {
                            const deps = checked
                              ? step.dependsOn.filter(d => d !== prevStep.id)
                              : [...step.dependsOn, prevStep.id];
                            updateStep(i, 'dependsOn', deps);
                          }}
                          className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition-all ${
                            checked
                              ? 'bg-accent-dim text-accent ring-1 ring-accent/20'
                              : 'bg-surface-3 text-white/20 hover:text-white/40'
                          }`}
                        >
                          {prevStep.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2.5 border-t border-border-subtle px-6 py-4">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-[12px] text-white/30 transition-colors hover:text-white/60"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-surface-0 transition-all hover:brightness-110"
        >
          Save Workflow
        </button>
      </div>
    </div>
  );
}
