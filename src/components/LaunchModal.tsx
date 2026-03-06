import { useState, useEffect, useRef } from 'react';
import { startAgent } from '../hooks/useAgents';

interface LaunchModalProps {
  onClose: () => void;
}

export function LaunchModal({ onClose }: LaunchModalProps) {
  const [prompt, setPrompt] = useState('');
  const [cwd, setCwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cwdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cwdRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-white/25">
              Working Directory
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-accent/40 pointer-events-none select-none">$</span>
              <input
                ref={cwdRef}
                type="text"
                value={cwd}
                onChange={e => setCwd(e.target.value)}
                placeholder="/path/to/project"
                className="input-field font-mono pl-7"
              />
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
          <div className="flex gap-2.5">
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
          </div>
        </div>
      </div>
    </div>
  );
}
