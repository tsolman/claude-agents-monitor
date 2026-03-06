import { useState, useEffect } from 'react';
import { useAgents } from './hooks/useAgents';
import { Dashboard } from './components/Dashboard';
import { HistoryView } from './components/HistoryView';
import { WorkflowView } from './components/WorkflowView';
import { ProjectsView } from './components/ProjectsView';
import { Notifications } from './components/Notifications';

type Tab = 'monitor' | 'workflows' | 'history' | 'projects';

const tabs: { id: Tab; label: string; shortcut: string }[] = [
  { id: 'monitor', label: 'Monitor', shortcut: '1' },
  { id: 'workflows', label: 'Workflows', shortcut: '2' },
  { id: 'history', label: 'History', shortcut: '3' },
  { id: 'projects', label: 'Projects', shortcut: '4' },
];

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('monitor');
  const [now, setNow] = useState(Date.now());
  const { state, connected, history, notifications, dismissNotification } =
    useAgents();

  // Update "time ago" every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts for tab switching
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '1') setActiveTab('monitor');
      else if (e.key === '2') setActiveTab('workflows');
      else if (e.key === '3') setActiveTab('history');
      else if (e.key === '4') setActiveTab('projects');
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div className="scanlines grain min-h-screen bg-surface-0 bg-grid">
      {/* Header */}
      <header className="relative border-b border-border-subtle">
        {/* Animated gradient sweep border */}
        <div className="absolute bottom-0 left-0 right-0 h-px header-sweep" />

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-8 w-8 items-center justify-center overflow-visible">
              {/* Pulsing ring */}
              <span className="absolute inset-0 rounded-lg bg-accent/10 animate-ring-pulse" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim ring-1 ring-accent/20">
                <span className="font-mono text-xs font-bold text-accent">
                  CA
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-white/90">
                Claude Agents Monitor
              </h1>
              {state && (
                <p className="font-mono text-[10px] tracking-wide text-white/25">
                  {state.hostname}
                </p>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-6">
            {state && (
              <span className="font-mono text-[11px] text-white/20">
                {timeAgo(state.timestamp)}
              </span>
            )}
            {/* Connection status pill */}
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                connected
                  ? 'bg-live-dim ring-1 ring-live/15'
                  : 'bg-danger-dim ring-1 ring-danger/15'
              }`}
            >
              <div
                className={`status-dot ${connected ? 'status-dot-live' : 'status-dot-off'}`}
              />
              <span
                className={`font-mono text-[11px] font-medium tracking-wide ${
                  connected ? 'text-live' : 'text-danger'
                }`}
              >
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b border-border-subtle/60">
        <div className="mx-auto flex max-w-6xl items-center px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-accent'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {tab.label}
              <kbd
                className={`rounded px-1 py-0.5 font-mono text-[9px] ${
                  activeTab === tab.id
                    ? 'bg-accent-dim text-accent/60'
                    : 'bg-surface-2 text-white/15 group-hover:text-white/30'
                }`}
              >
                {tab.shortcut}
              </kbd>
              {/* Active indicator */}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        {activeTab === 'monitor' && (
          <Dashboard state={state} connected={connected} history={history} />
        )}
        {activeTab === 'workflows' && <WorkflowView />}
        {activeTab === 'history' && <HistoryView history={history} />}
        {activeTab === 'projects' && <ProjectsView />}
      </main>

      {/* Notifications */}
      <Notifications events={notifications} onDismiss={dismissNotification} />
    </div>
  );
}
