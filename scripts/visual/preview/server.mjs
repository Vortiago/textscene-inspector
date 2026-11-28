/**
 * Starts, reaches and stops the `vite preview` server, and refuses to capture from one this
 * harness did not start.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { once } from 'node:events';
import { onHarnessExit } from './onHarnessExit.mjs';
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

export function startPreview(port, ownerPath) {
  // The child is the listening process on Windows and POSIX.
  const cwd = join(REPO_ROOT, 'apps/textscene-web');
  const proc = spawn(
    process.execPath,
    [
      '--import',
      new URL('./childBuildLock.mjs', import.meta.url).href,
      join(cwd, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd,
      env: { ...process.env, TEXTSCENE_PREVIEW_LOCK_OWNER: ownerPath, TEXTSCENE_PREVIEW_SERVER: '1' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      detached: true,
    }
  );
  reapPreviewGroupOnExit(proc);
  return { proc, baseUrl: `http://localhost:${port}` };
}

export function reapPreviewGroupOnExit(proc) {
  // A synchronous exit cannot wait for Vite's graceful shutdown.
  const unregister = onHarnessExit((reason) =>
    killPreviewGroup(proc, reason === 'exit' ? 'SIGKILL' : 'SIGTERM')
  );
  proc.once('exit', unregister);
}

export async function killPreviewGroup(proc, signal = 'SIGTERM') {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  const stopped = once(proc, 'exit');
  try {
    process.kill(process.platform === 'win32' ? proc.pid : -proc.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await stopped;
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
