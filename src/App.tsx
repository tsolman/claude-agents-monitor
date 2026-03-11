import { useState, useEffect } from 'react';
import { useAgents } from './hooks/useAgents';
import { Dashboard } from './components/Dashboard';
import { HistoryView } from './components/HistoryView';
import { WorkflowView } from './components/WorkflowView';
import { ProjectsView } from './components/ProjectsView';
import { Notifications } from './components/Notifications';

type Tab = 'monitor' | 'workflows' | 'history' | 'projects';

const tabIcons: Record<Tab, JSX.Element> = {
  monitor: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 8h3l2-5 2 10 2-5h3" />
    </svg>
  ),
  workflows: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3" cy="4" r="1.5" /><circle cx="8" cy="4" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="13" cy="8" r="1.5" />
      <path d="M4.5 4h2M9.5 4l2 2.5L9.5 9v3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  history: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 2" />
    </svg>
  ),
  projects: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" opacity="0.9">
      <rect x="1" y="1" width="6" height="6" rx="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
};

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
  const { state, connected, history, notifications, dismissNotification, agentOutputs } =
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
            <div className="relative flex h-9 w-9 items-center justify-center overflow-visible">
              <span className="absolute inset-0 rounded-xl bg-accent/8 animate-ring-pulse" />
              <svg className="relative w-9 h-9" viewBox="0 0 36 36" fill="none">
                <rect x="1" y="1" width="34" height="34" rx="9" fill="#0c1017" stroke="#1a1f2b" strokeWidth="1" />
                <circle cx="18" cy="18" r="10.5" stroke="#e8a23e" strokeWidth="0.75" fill="none" opacity="0.12" />
                <path d="M18 7.5 A10.5 10.5 0 0 1 28.5 18" stroke="#58a6ff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M28.5 18 A10.5 10.5 0 0 1 18 28.5" stroke="#bc8cff" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.7" />
                <path d="M18 28.5 A10.5 10.5 0 0 1 7.5 18" stroke="#56d4dd" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.5" />
                <circle cx="18" cy="18" r="3" fill="#e8a23e" opacity="0.15" />
                <circle cx="18" cy="18" r="2" fill="#e8a23e" />
                <circle cx="18" cy="7.5" r="1.8" fill="#58a6ff" />
                <circle cx="28.5" cy="18" r="1.8" fill="#bc8cff" />
                <circle cx="18" cy="28.5" r="1.8" fill="#56d4dd" />
              </svg>
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
              {tabIcons[tab.id]}
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
          <Dashboard state={state} connected={connected} history={history} agentOutputs={agentOutputs} />
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
