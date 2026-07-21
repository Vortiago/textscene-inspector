/**
 * Build-and-serve lifecycle for the previewer, shared by every harness that
 * captures from a real browser: the visual-regression gate (`run.mjs`) and the
 * parity capture (`scripts/godot-ref/capture-ours.mjs`).
 *
 * Extracted rather than duplicated because the hard-won parts here are the
 * failure modes, not the happy path — a stale `dist/`, a foreign server on the
 * port, and an orphaned `vite preview` grandchild each produce a harness that
 * reports success while measuring the wrong thing. A second copy would drift
 * out of those protections silently.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '../..');
const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');

const SKIP_BUILD_VALUES = new Set(['1', 'true', 'yes']);

/**
 * Build the previewer every run. Reusing an existing `dist/` is how this
 * harness silently captured a build that predated the change under test —
 * every scene "passed" against stale code, and a newly added fixture was
 * missing from the bundle entirely, so its deep link fell back and baked a
 * bogus baseline. A stale-green visual suite is worse than a slow one; set
 * VISUAL_SKIP_BUILD=1 to reuse `dist/` while iterating locally.
 */
export function ensureWebBuilt(log = console.log) {
  const skip = process.env.VISUAL_SKIP_BUILD;
  if (skip !== undefined && !SKIP_BUILD_VALUES.has(skip.trim().toLowerCase())) {
    console.warn(`[preview] VISUAL_SKIP_BUILD="${skip}" not recognised — building anyway`);
  } else if (skip !== undefined && existsSync(WEB_DIST_INDEX)) {
    log('[preview] VISUAL_SKIP_BUILD set — reusing existing dist/ (may be stale)');
    return;
  }
  log('[preview] building web previewer…');
  const r = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[preview] web previewer build failed');
    process.exit(1);
  }
}

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

export function startPreview(port) {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(port), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
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
