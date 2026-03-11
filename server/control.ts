import { spawn } from 'child_process';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';

export async function stopAgent(
  pid: number,
  force = false
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { success: false, error: 'Invalid PID' };
  }

  try {
    // Try SIGTERM first
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');

    if (!force) {
      // Wait up to 2s for process to exit, then escalate to SIGKILL
      const dead = await waitForExit(pid, 2000);
      if (!dead) {
        process.kill(pid, 'SIGKILL');
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // ESRCH means process already gone -- that's fine
    if (message.includes('ESRCH')) {
      return { success: true };
    }
    return { success: false, error: message };
  }
}

function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      try {
        process.kill(pid, 0); // signal 0 = check if alive
        if (Date.now() - start > timeoutMs) {
          resolve(false); // still alive after timeout
        } else {
          setTimeout(check, 200);
        }
      } catch {
        resolve(true); // process is gone
      }
    };
    check();
  });
}

export interface StartAgentOptions {
  prompt: string;
  cwd: string;
  onOutput?: (pid: number, line: string) => void;
}

// Resolve the full path to claude binary once at startup
let claudePath: string | null = null;
try {
  claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
} catch {
  // claude not found in PATH -- will fail at spawn time
}

// ─── Agent output buffer ─────────────────────────────────
const MAX_OUTPUT_LINES = 500;
const outputBuffers = new Map<number, string[]>();
const outputComplete = new Set<number>();

export function getAgentOutput(pid: number): string[] {
  return outputBuffers.get(pid) || [];
}

export function clearAgentOutput(pid: number): void {
  outputBuffers.delete(pid);
  outputComplete.delete(pid);
}

export function startAgent(
  options: StartAgentOptions
): Promise<{ success: boolean; pid?: number; error?: string }> {
  return new Promise(resolve => {
    // Validate cwd exists
    if (!fs.existsSync(options.cwd)) {
      resolve({ success: false, error: `Directory not found: ${options.cwd}` });
      return;
    }

    if (!fs.statSync(options.cwd).isDirectory()) {
      resolve({ success: false, error: `Not a directory: ${options.cwd}` });
      return;
    }

    const bin = claudePath || 'claude';

    const child = spawn(bin, ['-p', '--output-format', 'stream-json', options.prompt], {
      cwd: options.cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;

    child.on('error', (err: Error) => {
      if (!settled) {
        settled = true;
        resolve({ success: false, error: err.message });
      }
    });

    // Give spawn 500ms to fail (ENOENT, EACCES, etc.)
    // If no error by then, assume successful spawn
    setTimeout(() => {
      if (!settled) {
        settled = true;
        if (child.pid) {
          if (child.stdout) {
            const rl = createInterface({ input: child.stdout });
            rl.on('line', (line: string) => {
              const buf = outputBuffers.get(child.pid!) || [];
              buf.push(line);
              if (buf.length > MAX_OUTPUT_LINES) buf.shift();
              outputBuffers.set(child.pid!, buf);
              options.onOutput?.(child.pid!, line);
            });
          }

          child.on('close', () => {
            if (child.pid) outputComplete.add(child.pid);
          });

          resolve({ success: true, pid: child.pid });
        } else {
          resolve({ success: false, error: 'Failed to spawn process (no PID)' });
        }
      }
    }, 500);
  });
}
