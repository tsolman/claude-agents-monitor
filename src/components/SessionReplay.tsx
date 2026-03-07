import { useState, useEffect } from 'react';
import { getSessionReplay } from '../hooks/useAgents';
import type { ReplayMessage } from '../hooks/useAgents';

interface SessionReplayProps {
  projectId: string;
  sessionId: string;
  sessionPrompt: string;
  onClose: () => void;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function MessageBubble({ message }: { message: ReplayMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.type === 'user';
  const isLong = message.content.length > 800;
  const displayContent = isLong && !expanded ? message.content.slice(0, 800) + '...' : message.content;

  return (
    <div className={`${isUser ? 'max-w-[85%]' : 'max-w-[92%]'}`}>
      <div
        className={`rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-data-blue-dim ring-1 ring-data-blue/15'
            : 'bg-surface-2 ring-1 ring-border-subtle'
        }`}
      >
        {/* Label row */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] font-mono font-bold tracking-wider ${
                isUser ? 'text-data-blue/70' : 'text-live/70'
              }`}
            >
              {isUser ? 'YOU' : 'CLAUDE'}
            </span>
            {!isUser && message.model && (
              <span className="text-[9px] font-mono text-white/20">
                {message.model}
              </span>
            )}
          </div>
          <span className="font-mono text-[9px] text-white/15">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Content */}
        <div className="font-mono text-[12px] text-white/40 whitespace-pre-wrap leading-relaxed">
          {displayContent}
        </div>

        {/* Expand toggle */}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[10px] font-mono text-accent/50 hover:text-accent transition-colors"
          >
            {expanded ? 'Collapse' : 'Show full response'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionReplay({ projectId, sessionId, sessionPrompt, onClose }: SessionReplayProps) {
  const [messages, setMessages] = useState<ReplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSessionReplay(projectId, sessionId);
        setMessages(data.messages || []);
      } catch {
        setError('Failed to load session replay');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, sessionId]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-[800px] max-h-[85vh] flex flex-col border-border-strong shadow-2xl shadow-black/50 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4 shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[14px] font-semibold text-white/90 truncate">
                {truncate(sessionPrompt || 'Session Replay', 60)}
              </h2>
              <span className="rounded-full bg-data-purple-dim px-2 py-0.5 text-[9px] font-mono text-data-purple/70 shrink-0">
                {messages.length} msg{messages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-white/20 truncate">
              {sessionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/20 transition-colors hover:bg-surface-3 hover:text-white/50 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-white/30 text-sm">Loading session...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-danger/60 text-sm">{error}</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-white/20 text-sm">No messages found in this session</div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
