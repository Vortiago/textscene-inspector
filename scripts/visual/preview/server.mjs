/**
 * Starts, reaches and stops the `vite preview` server, and refuses to capture from one this
 * harness did not start.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { constants } from 'node:os';
import { REPO_ROOT } from './paths.mjs';

/**
 * Refuses to capture from another process's server. `--strictPort` makes our detached spawn
 * (`stdio: 'ignore'`) fail silently on an occupied port, and `waitForServer` accepts any 200, so a
 * leftover or a concurrent worktree's server would answer and every capture would show its build.
 */
export async function assertPortFree(port, envVarName = 'VISUAL_PORT') {
  const free = await new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
  if (!free) {
    console.error(
      `\n[preview] port ${port} is already in use by another process — refusing to capture ` +
        `against an unverified server (it may be a leftover preview from a previous run, or a ` +
        `concurrent worktree on this host also running a capture harness). Free the port, or ` +
        `set ${envVarName}=<free-port> to use a different one.\n`
    );
    process.exit(1);
  }
}

export function startPreview(port) {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(port), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
  // Registered at the spawn, so no launcher can forget it.
  reapPreviewGroupOnExit(proc);
  return { proc, baseUrl: `http://localhost:${port}` };
}

/**
 * SIGHUP arrives when the terminal closes. The detached group is in its own session and gets no
 * SIGHUP, so the harness reaps it then too.
 */
const TERMINATING_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * Reaps the preview group when this process ends, however it ends. `detached: true` lets the group
 * outlive us and escape the terminal's Ctrl-C, and Node runs no `finally` on a signal. The `exit`
 * handler covers every end and stays synchronous. A caught signal ends the process with
 * `process.exit(128 + signal number)`, not a re-raise, so the `exit` handlers run: this one reaps
 * the group, and Playwright's closes its browser. SIGKILL cannot be caught and is the one path that
 * orphans a server.
 */
export function reapPreviewGroupOnExit(proc) {
  process.once('exit', () => killPreviewGroup(proc));
  for (const signal of TERMINATING_SIGNALS) {
    process.once(signal, () => process.exit(128 + constants.signals[signal]));
  }
}

/**
 * Kills the whole process group of `proc` (negative pid). `proc` is the shell of a `shell: true`
 * spawn, not the `pnpm` to `vite preview` grandchild that binds the port, which would outlive it
 * and hold this script's event loop open. ESRCH is swallowed: the group may already be gone.
 */
export function killPreviewGroup(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    /* already exited */
  }
}

export async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server at ${url} not ready in ${timeoutMs}ms`);
}
