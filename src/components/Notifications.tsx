import { useEffect, useRef } from 'react';
import type { AgentEvent } from '../types';

interface NotificationsProps {
  events: AgentEvent[];
  onDismiss: (index: number) => void;
}

export function Notifications({ events, onDismiss }: NotificationsProps) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 flex flex-col gap-2.5">
      {events.map((event, i) => (
        <Toast
          key={`${event.pid}-${event.timestamp}`}
          event={event}
          onDismiss={() => onDismiss(i)}
        />
      ))}
    </div>
  );
}

function Toast({
  event,
  onDismiss,
}: {
  event: AgentEvent;
  onDismiss: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  const isStarted = event.type === 'started';
  const project = event.workingDirectory?.split('/').pop() || 'unknown';
  const color = isStarted ? '#3fb950' : '#6e7681';

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-surface-2/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-xl animate-slide-in-right"
    >
      <span
        className="block h-2 w-2 shrink-0 rounded-full"
        style={{
          background: color,
          boxShadow: isStarted ? `0 0 6px ${color}80` : undefined,
        }}
      />
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-white/70">
          Agent {isStarted ? 'started' : 'stopped'}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-white/25">
          PID {event.pid} &middot; {project}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="ml-2 shrink-0 rounded-md p-1 text-white/15 transition-colors hover:bg-surface-4 hover:text-white/40"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
