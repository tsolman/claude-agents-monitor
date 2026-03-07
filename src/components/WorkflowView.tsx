import { useState, useEffect, useCallback, useRef } from 'react';
import type { Workflow, WorkflowRun, WorkflowStep } from '../types';
import {
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
  cancelWorkflowRun,
  exportWorkflowJson,
  importWorkflowJson,
  getWorkflowTemplates as fetchWorkflowTemplates,
  createFromTemplate,
} from '../hooks/useAgents';
import type { WorkflowTemplate } from '../hooks/useAgents';
import { ConfirmDialog } from './ConfirmDialog';

export function WorkflowView() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [wf, rn] = await Promise.all([getWorkflows(), getWorkflowRuns()]);
    setWorkflows(wf.workflows);
    setRuns(rn.runs);
  }, []);

  useEffect(() => {
    refresh();
    fetchWorkflowTemplates().then(r => setTemplates(r.templates));
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

  const handleImport = async (file: File) => {
    try {
      await importWorkflowJson(file);
      refresh();
    } catch {
      alert('Import failed: invalid or corrupt workflow file.');
    }
  };

  const handleCreateFromTemplate = async (templateId: string, cwd: string) => {
    await createFromTemplate(templateId, cwd);
    setSelectedTemplate(null);
    refresh();
  };

  const categoryColors: Record<string, { badge: string; border: string; bg: string }> = {
    quality: {
      badge: 'bg-data-blue/15 text-data-blue ring-data-blue/20',
      border: 'ring-data-blue/10 hover:ring-data-blue/25',
      bg: 'text-data-blue/60',
    },
    docs: {
      badge: 'bg-data-purple/15 text-data-purple ring-data-purple/20',
      border: 'ring-data-purple/10 hover:ring-data-purple/25',
      bg: 'text-data-purple/60',
    },
    fix: {
      badge: 'bg-accent/15 text-accent ring-accent/20',
      border: 'ring-accent/10 hover:ring-accent/25',
      bg: 'text-accent/60',
    },
  };

  const groupedTemplates = templates.reduce<Record<string, WorkflowTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Templates section */}
      {templates.length > 0 && (
        <div>
          <h2 className="mb-5 text-[13px] font-medium uppercase tracking-widest text-white/30">
            Templates
          </h2>
          <div className="space-y-6">
            {Object.entries(groupedTemplates).map(([category, catTemplates]) => (
              <div key={category}>
                <span
                  className={`mb-3 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                    categoryColors[category]?.badge || 'bg-surface-3 text-white/30 ring-border'
                  }`}
                >
                  {category}
                </span>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`card group cursor-pointer p-4 text-left transition-all ring-1 ${
                        categoryColors[template.category]?.border || 'ring-border hover:ring-border-strong'
                      }`}
                    >
                      <h4 className="text-[13px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">
                        {template.name}
                      </h4>
                      <p className="mt-1 text-[11px] text-white/25 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-white/15">
                          {template.steps.length} {template.steps.length === 1 ? 'step' : 'steps'}
                        </span>
                        <span className={`font-mono text-[10px] ${categoryColors[template.category]?.bg || 'text-white/20'}`}>
                          {template.steps.filter(s => s.dependsOn.length > 0).length > 0 ? 'sequential' : 'parallel'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template CWD modal */}
      {selectedTemplate && (
        <TemplateCwdModal
          template={selectedTemplate}
          onSubmit={(cwd) => handleCreateFromTemplate(selectedTemplate.id, cwd)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Workflows section */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-white/30">
            Workflows
          </h2>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-surface-2 px-3.5 py-2 text-[12px] font-medium text-white/40 ring-1 ring-border transition-all hover:text-white/60 hover:ring-border-strong"
            >
              Import
            </button>
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
                onExport={() => exportWorkflowJson(wf.id)}
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
  onExport,
}: {
  workflow: Workflow;
  onRun: () => void;
  onDelete: () => void;
  onExport: () => void;
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
            onClick={onExport}
            className="rounded-lg px-3 py-1.5 font-mono text-[10px] font-medium text-white/20 transition-all hover:bg-surface-3 hover:text-white/40"
          >
            EXPORT
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
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

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
          const hasOutput = status.output && status.output.trim().length > 0;
          const isExpanded = expandedStep === stepId;
          return (
            <div key={stepId}>
              <button
                onClick={() => hasOutput && setExpandedStep(isExpanded ? null : stepId)}
                className={`flex w-full items-center gap-2 py-1 font-mono text-[10px] text-left ${
                  hasOutput ? 'cursor-pointer hover:bg-surface-2/30 -mx-2 px-2 rounded' : 'cursor-default'
                }`}
              >
                <span
                  className="block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: dotColors[status.status] }}
                />
                <span className="text-white/25">{stepId.slice(0, 8)}</span>
                <span className="text-white/12">{status.status}</span>
                {status.error && (
                  <span className="text-danger/60">{status.error}</span>
                )}
                {hasOutput && (
                  <span className="ml-auto text-white/10">
                    {isExpanded ? '▾ output' : '▸ output'}
                  </span>
                )}
              </button>
              {isExpanded && status.output && (
                <pre className="mt-1 mb-2 max-h-60 overflow-auto rounded-lg bg-surface-0 p-3 font-mono text-[10px] leading-relaxed text-white/40 ring-1 ring-border-subtle whitespace-pre-wrap break-words">
                  {status.output}
                </pre>
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

function useDirSuggestions(input: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (!input.startsWith('/')) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/directories?path=${encodeURIComponent(input)}`);
        const data = await res.json();
        setSuggestions(data.directories || []);
      } catch {
        setSuggestions([]);
      }
    }, 150);

    return () => clearTimeout(timerRef.current);
  }, [input]);

  return suggestions;
}

function TemplateCwdModal({
  template,
  onSubmit,
  onClose,
}: {
  template: WorkflowTemplate;
  onSubmit: (cwd: string) => void;
  onClose: () => void;
}) {
  const [cwd, setCwd] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useDirSuggestions(cwd);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    setSelectedIdx(-1);
  }, [suggestions]);

  const pickSuggestion = useCallback((dir: string) => {
    setCwd(dir + '/');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Tab' && cwd.startsWith('/')) {
        e.preventDefault();
        setShowSuggestions(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
        e.preventDefault();
        pickSuggestion(suggestions[selectedIdx]);
      } else if (suggestions.length === 1) {
        e.preventDefault();
        pickSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async () => {
    if (!cwd.trim()) return;
    setLoading(true);
    try {
      await onSubmit(cwd.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card scanline-overlay w-full max-w-md border-border-strong p-0 shadow-2xl shadow-black/50 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-white/85">
              {template.name}
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-white/20">
              {template.steps.length} {template.steps.length === 1 ? 'step' : 'steps'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/20 transition-colors hover:bg-surface-3 hover:text-white/50"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-[12px] text-white/30">{template.description}</p>

          <div>
            <label className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/25">
                Working Directory
              </span>
              <span className="font-mono text-[9px] text-white/10">
                tab to autocomplete
              </span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none font-mono text-[12px] text-accent/40">$</span>
              <input
                ref={inputRef}
                type="text"
                value={cwd}
                onChange={e => {
                  setCwd(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="/path/to/project"
                className="input-field pl-7 font-mono"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg bg-surface-2 py-1 ring-1 ring-border">
                  {suggestions.map((dir, i) => (
                    <button
                      key={dir}
                      onMouseDown={e => {
                        e.preventDefault();
                        pickSuggestion(dir);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] transition-colors ${
                        i === selectedIdx
                          ? 'bg-accent-dim text-accent'
                          : 'text-white/40 hover:bg-surface-3 hover:text-white/60'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 opacity-40">
                        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7z" />
                      </svg>
                      {dir}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Steps preview */}
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-white/15">
              Steps
            </span>
            <div className="space-y-1">
              {template.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 text-[9px] text-white/25">
                    {i + 1}
                  </span>
                  <span className="text-white/35">{step.name}</span>
                  {step.dependsOn.length > 0 && (
                    <span className="text-white/10">
                      (after step {step.dependsOn.map(d => parseInt(d.replace('step-', '')) + 1).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border-subtle px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[12px] text-white/30 transition-colors hover:text-white/60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !cwd.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-surface-0 transition-all hover:brightness-110 disabled:opacity-40"
          >
            {loading ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}
