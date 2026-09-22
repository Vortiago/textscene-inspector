/**
 * Starting, reaching and stopping the `vite preview` server — and refusing to
 * capture from one this harness did not start.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { REPO_ROOT } from './paths.mjs';

/**
 * Refuse to silently capture from someone else's process. `--strictPort`
 * makes our own preview spawn fail on an occupied port, but that spawn runs
 * detached (`stdio: 'ignore'`) and `waitForServer` below only polls for *a*
 * 200 response — so without this check, an already-listening server (a
 * leftover from a previous run, or a concurrent worktree on the same host
 * also running a harness against the shared default port) would answer
 * instead, and every capture would silently reflect a foreign build.
 *
 * (This is also why `killPreviewGroup` below kills the whole process GROUP,
 * not just its direct child — a `shell: true` spawn's immediate child is the
 * shell, not the `pnpm`→`vite preview` grandchild that actually holds the
 * port; killing only the shell can leave that grandchild running as an
 * orphan, which is exactly the kind of leftover this check guards against.)
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
 * Reap the preview group when THIS process ends, however it ends.
 *
 * `detached: true` is what lets one signal reach the whole
 * `shell`→`pnpm`→`vite preview` group; it is equally what lets that group
 * outlive us. Every harness already calls `killPreviewGroup` from a `finally`,
 * but Node runs no `finally` when the process is signalled — so an interrupted
 * run (Ctrl-C, a CI step timing out, a supervisor's SIGTERM) leaves a server
 * holding its port with nothing left that knows about it. `assertPortFree`
 * above DETECTS that leftover on the next run; this prevents making one.
 *
 * Registered at the spawn rather than in each caller, so a new harness cannot
 * acquire the leak by forgetting to opt in.
 *
 * `exit` covers normal and thrown termination, and must stay synchronous —
 * `process.kill` is. The signal handlers reap and then re-raise, which reaches
 * the default disposition now that `once` has removed the listener, so the
 * harness still dies of the signal it was sent instead of reporting a clean
 * exit. SIGKILL cannot be caught and stays the one path that orphans a server.
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
  // `detached` puts the preview in its OWN process group, so the terminal's
  // Ctrl-C never reaches it — and a `finally` block does not run on signal
  // death either. Without this the server outlives the harness, holds the port,
  // and the next run aborts at `assertPortFree`. Registered here rather than in
  // each caller so a new launcher cannot forget it. `process.exit` still fires
  // `exit` listeners, which is how playwright closes any browser it launched.
  const stopOnSignal = (signal) => {
    killPreviewGroup(proc);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', stopOnSignal);
  process.once('SIGTERM', stopOnSignal);
  return { proc, baseUrl: `http://localhost:${port}` };
}

/**
 * Kill the whole `proc` process GROUP (negative pid), not just `proc` itself.
 * `proc` is a `shell: true` spawn's immediate child — the shell — not the
 * `pnpm`→`vite preview` grandchild that actually binds the port. `detached:
 * true` above makes `proc` its own process-group leader, so its descendants
 * share its pgid and `-proc.pid` reaches all of them in one signal. Killing
 * only `proc.pid` reliably kills the shell but can leave the grandchild
 * running as an orphaned server — which then holds this script's event loop
 * open indefinitely even after all real work is done, since nothing else is
 * scheduled to keep it alive except that leftover handle. Swallow ESRCH: the
 * group may already be gone.
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
