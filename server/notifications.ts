export interface AgentEvent {
  type: 'started' | 'stopped';
  pid: number;
  timestamp: number;
  workingDirectory: string | null;
}

const MAX_EVENTS = 200;
const events: AgentEvent[] = [];
let previousPids = new Set<number>();
let previousDirs = new Map<number, string | null>();

export function trackLifecycle(
  agents: Array<{ pid: number; workingDirectory: string | null }>
): AgentEvent[] {
  const currentPids = new Set(agents.map(a => a.pid));
  const currentDirs = new Map(agents.map(a => [a.pid, a.workingDirectory]));
  const newEvents: AgentEvent[] = [];

  // New agents
  for (const pid of currentPids) {
    if (!previousPids.has(pid)) {
      const event: AgentEvent = {
        type: 'started',
        pid,
        timestamp: Date.now(),
        workingDirectory: currentDirs.get(pid) ?? null,
      };
      events.push(event);
      newEvents.push(event);
    }
  }

  // Stopped agents
  for (const pid of previousPids) {
    if (!currentPids.has(pid)) {
      const event: AgentEvent = {
        type: 'stopped',
        pid,
        timestamp: Date.now(),
        workingDirectory: previousDirs.get(pid) ?? null,
      };
      events.push(event);
      newEvents.push(event);
    }
  }

  previousPids = currentPids;
  previousDirs = currentDirs;

  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  return newEvents;
}

export function getEvents(since?: number): AgentEvent[] {
  if (since) {
    return events.filter(e => e.timestamp > since);
  }
  return events.slice(-50);
}
