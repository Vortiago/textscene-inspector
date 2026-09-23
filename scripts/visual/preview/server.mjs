/**
 * Starts, reaches and stops the `vite preview` server, and refuses to capture from one this
 * harness did not start.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
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

/**
 * Reaps the preview group when this process ends, however it ends. `detached: true` lets the group
 * outlive us, and Node runs no `finally` on a signal. `exit` covers normal and thrown ends and
 * stays synchronous. A signal handler reaps and re-raises, so the harness dies of that signal.
 * SIGKILL cannot be caught and is the one path that orphans a server.
 */
export function registerPreviewGroupTeardown(proc) {
  const onExit = () => killPreviewGroup(proc);
  const onSignal = (signal) => {
    process.removeListener('exit', onExit);
    killPreviewGroup(proc);
    process.kill(process.pid, signal);
  };
  process.once('exit', onExit);
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGHUP', () => onSignal('SIGHUP'));
}

export function startPreview(port) {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(port), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
  // `detached` puts the preview in its own process group, out of reach of the terminal's Ctrl-C,
  // and no `finally` runs on a signal, so the server would hold the port for the next run. Set at
  // the spawn, so no launcher can forget it. `process.exit` still lets playwright close its browser.
  const stopOnSignal = (signal) => {
    killPreviewGroup(proc);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', stopOnSignal);
  process.once('SIGTERM', stopOnSignal);
  return { proc, baseUrl: `http://localhost:${port}` };
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
