import { useState, useEffect, useRef, useCallback } from 'react';
import { startAgent, getAgentTemplates, createAgentTemplate, deleteAgentTemplate } from '../hooks/useAgents';
import type { AgentTemplate } from '../hooks/useAgents';

interface LaunchModalProps {
  onClose: () => void;
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

export function LaunchModal({ onClose }: LaunchModalProps) {
  const [prompt, setPrompt] = useState('');
  const [cwd, setCwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const cwdRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const suggestions = useDirSuggestions(cwd);

  useEffect(() => {
    cwdRef.current?.focus();
  }, []);

  useEffect(() => {
    getAgentTemplates()
      .then(result => setTemplates(result.templates))
      .catch(() => {});
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

  const handleSelectTemplate = useCallback((template: AgentTemplate) => {
    setPrompt(template.prompt);
    if (template.cwd) setCwd(template.cwd);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !prompt.trim()) return;
    setSavingTemplate(true);
    try {
      const template = await createAgentTemplate({
        name: templateName.trim(),
        prompt: prompt.trim(),
        cwd: cwd.trim() || undefined,
      });
      setTemplates(prev => [...prev, template]);
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch {
      // ignore
    } finally {
      setSavingTemplate(false);
    }
  }, [templateName, prompt, cwd]);

  const handleDeleteTemplate = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteAgentTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      // ignore
    }
  }, []);

  const pickSuggestion = useCallback((dir: string) => {
    setCwd(dir + '/');
    setShowSuggestions(false);
    cwdRef.current?.focus();
  }, []);

  const handleCwdKeyDown = (e: React.KeyboardEvent) => {
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

  const handleLaunch = async () => {
    if (!prompt.trim() || !cwd.trim()) {
      setError('Both fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await startAgent(prompt.trim(), cwd.trim());
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to start agent');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card scanline-overlay w-full max-w-lg border-border-strong p-0 shadow-2xl shadow-black/50 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-white/85">
              Launch Agent
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-white/20">
              claude -p &lt;prompt&gt;
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
        <div className="space-y-5 px-6 py-5">
          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-white/25">
                Templates
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="group relative flex shrink-0 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left ring-1 ring-border-subtle transition-all hover:bg-surface-3 hover:ring-accent/30"
                  >
                    <span className="text-[12px] text-white/50 group-hover:text-white/70">
                      {t.icon || '>'} {t.name}
                    </span>
                    <button
                      onClick={(e) => handleDeleteTemplate(t.id, e)}
                      className="ml-1 text-[10px] text-white/10 hover:text-danger transition-colors"
                    >
                      x
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-accent/40 pointer-events-none select-none">$</span>
              <input
                ref={cwdRef}
                type="text"
                value={cwd}
                onChange={e => {
                  setCwd(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay so click on suggestion registers
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                onKeyDown={handleCwdKeyDown}
                placeholder="/path/to/project"
                className="input-field font-mono pl-7"
                autoComplete="off"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg bg-surface-2 py-1 ring-1 ring-border"
                >
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

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-white/25">
              Prompt
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 font-mono text-[12px] text-accent/40 pointer-events-none select-none">&gt;</span>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What should this agent do?"
                rows={4}
                className="input-field resize-none font-mono pl-7"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.metaKey) handleLaunch();
                }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-dim p-3 text-[12px] text-danger ring-1 ring-danger/10">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle px-6 py-4">
          <span className="font-mono text-[9px] text-white/10">
            cmd+enter to launch
          </span>
          <div className="flex items-center gap-2.5">
            {showSaveTemplate ? (
              <>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="input-field w-40 py-1.5 text-[11px]"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTemplate();
                    if (e.key === 'Escape') setShowSaveTemplate(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent-dim disabled:opacity-30"
                >
                  {savingTemplate ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSaveTemplate(false)}
                  className="rounded-lg px-2 py-1.5 text-[11px] text-white/30 hover:text-white/60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {prompt.trim() && (
                  <button
                    onClick={() => setShowSaveTemplate(true)}
                    className="rounded-lg px-3 py-2 text-[11px] text-white/20 transition-colors hover:text-white/50"
                  >
                    Save as Template
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-[12px] text-white/30 transition-colors hover:text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-surface-0 transition-all hover:brightness-110 disabled:opacity-40"
                >
                  {loading ? 'Launching...' : 'Launch'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
