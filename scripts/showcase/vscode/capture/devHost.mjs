/**
 * The extension dev-host as a process: find a VS Code binary, launch it (under
 * xvfb when there is no X server), wait for its CDP endpoint, and kill the
 * whole tree afterwards.
 *
 * Every function here exists for a failure mode that otherwise leaves an
 * orphaned Electron holding the user-data-dir, or a capture that silently
 * shoots the wrong window.
 */

import { spawn, execSync } from 'node:child_process';
import { rmSync, existsSync, readdirSync } from 'node:fs';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { SWIFTSHADER_GL_ARGS } from '../../browser.mjs';
import { HEADLESS, IS_LINUX, IS_WIN, sleep } from './platform.mjs';
import { EXT, PORT, UD, VSCODE_CACHE, WS } from './paths.mjs';

/** Kill only OUR dev-host instances (matched by the user-data-dir marker), never the user's VS Code. */
export function killStaleHost(udMarker) {
  try {
    if (IS_WIN) {
      execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Code.exe'\\" | Where-Object { $_.CommandLine -like '*${udMarker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
        { stdio: 'ignore' }
      );
    } else {
      // SIGKILL (mirrors the Windows -Force above): the dev-host's Electron
      // main catches SIGTERM and shuts down slowly under xvfb, so a plain
      // signal leaks orphans. pkill -f matches the full command line; only our
      // dev-host (and its xvfb-run wrapper) carry the showcase --user-data-dir
      // marker, so the user's own VS Code (a different user-data-dir) is never
      // touched — nor is this node process (its argv is just the script path).
      execSync(`pkill -9 -f -- ${udMarker}`, { stdio: 'ignore' });
    }
  } catch { /* nothing matched (pkill exits 1 when no process matches) */ }
}

/** SIGKILL the launched process group — xvfb-run + Xvfb + the dev-host it wraps. */
export function killProcessTree(proc) {
  try {
    // Negative PID targets the whole process group. `detached` made the spawned
    // command a group leader (pgid === proc.pid), so this reaches the Xvfb that
    // xvfb-run started — it carries no user-data-dir marker for killStaleHost to
    // match, and xvfb-run's own cleanup trap does not fire on a killed parent.
    if (IS_WIN) proc.kill();
    else if (proc.pid) process.kill(-proc.pid, 'SIGKILL'); // no pid ⇒ launch never started
  } catch { /* already gone */ }
}

/** Remove the throwaway user-data-dir, retrying while a dying host still holds a lock. */
export async function rmRetry(dir) {
  for (let i = 0; i < 12; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { /* locked — host still dying */ }
    await sleep(500);
  }
}

/** Platform executable inside a downloaded VS Code dir (mirrors @vscode/test-electron). */
function execInDir(dir) {
  if (IS_WIN) return `${dir}/Code.exe`;
  if (process.platform === 'darwin') return `${dir}/Visual Studio Code.app/Contents/MacOS/Electron`;
  return `${dir}/code`;
}

/** Numeric version tuple from a `vscode-<platform>-<a.b.c>` cache dir (missing → -Infinity). */
export function cacheDirVersion(dir) {
  const m = /(\d+)\.(\d+)\.(\d+)\b/.exec(dir);
  return m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]) : -Infinity;
}

/** The newest finished VS Code build in the shared cache, or null. */
function cachedVscode() {
  if (!existsSync(VSCODE_CACHE)) return null;
  const dirs = readdirSync(VSCODE_CACHE)
    .filter((d) => d.startsWith('vscode-') && existsSync(`${VSCODE_CACHE}/${d}/is-complete`))
    // Highest semver first — a lexical sort would rank 1.99.0 above 1.128.1.
    .sort((a, b) => cacheDirVersion(b) - cacheDirVersion(a));
  for (const d of dirs) {
    const exe = execInDir(`${VSCODE_CACHE}/${d}`);
    if (existsSync(exe)) return exe;
  }
  return null;
}

/** A `code`/`code.exe` on PATH, or null. */
function codeOnPath() {
  try {
    const probe = IS_WIN ? 'where code.exe 2>NUL & where code.cmd 2>NUL' : 'command -v code';
    const out = execSync(probe, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    return out || null;
  } catch { return null; }
}

/** Resolve a VS Code binary: $VSCODE_BIN → PATH (non-headless) → shared cache → download. */
async function resolveVscodeBin() {
  if (process.env.VSCODE_BIN) return { bin: process.env.VSCODE_BIN, viaPath: false };
  // Skip a PATH `code` under xvfb: it's a launcher that detaches the real
  // Electron and returns, so xvfb-run tears down Xvfb before the webview paints.
  // The cached/downloaded build is the direct binary that stays in the foreground.
  if (!HEADLESS) {
    const onPath = codeOnPath();
    if (onPath) return { bin: onPath, viaPath: true };
  }
  const cached = cachedVscode();
  if (cached) return { bin: cached, viaPath: false };
  console.log('[vscode] no cached/installed VS Code — downloading (first run, a few minutes)…');
  const bin = await downloadAndUnzipVSCode({ cachePath: VSCODE_CACHE });
  return { bin, viaPath: false };
}

export async function waitCDP() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/json/version`); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(1000);
  }
  throw new Error('CDP never came up');
}

/** The exact argv the dev-host is spawned with, for a resolved binary. */
export function buildLaunchCommand(bin, viaPath) {
  const vscodeArgs = [
    `--extensionDevelopmentPath=${EXT}`,
    `--user-data-dir=${UD}`,
    `--remote-debugging-port=${PORT}`,
    '--new-window', '--disable-workspace-trust', '--disable-updates',
    '--skip-welcome', '--skip-release-notes',
  ];
  if (IS_LINUX) {
    // Sandbox flags: the cached chrome-sandbox is not setuid, so the namespace
    // sandbox may be unavailable under xvfb — @vscode/test-electron passes these
    // for exactly this reason.
    vscodeArgs.push('--no-sandbox', '--disable-gpu-sandbox', ...SWIFTSHADER_GL_ARGS);
  }
  vscodeArgs.push(WS);

  let cmd = bin;
  let spawnArgs = vscodeArgs;
  if (HEADLESS) {
    cmd = 'xvfb-run';
    // -a: pick a free display. 24-bit depth is required for GL; 1920x1080 also
    // sizes the window and therefore the screenshot. The -screen string is ONE
    // argv element (no shell) — spawn passes it verbatim to xvfb-run's getopt.
    spawnArgs = ['-a', '--server-args=-screen 0 1920x1080x24', bin, ...vscodeArgs];
  }
  // On Windows a `code` resolved from PATH is code.cmd, which needs a shell to run.
  return { cmd, spawnArgs, useShell: IS_WIN && viaPath };
}

/**
 * Spawn the dev-host. Returns the child plus a promise that REJECTS on a
 * failed launch: a missing launcher (no xvfb-run, bad $VSCODE_BIN) emits an
 * async 'error' with no pid, and surfacing it as a rejection is what lets
 * catch/finally run instead of an uncaughtException crashing the process past
 * cleanup. A late error after CDP is up settles this already-resolved race
 * harmlessly (the listener prevents a throw either way).
 */
export async function launchDevHost() {
  const { bin, viaPath } = await resolveVscodeBin();
  const { cmd, spawnArgs, useShell } = buildLaunchCommand(bin, viaPath);
  console.log(`[vscode] launching dev-host (${cmd === 'xvfb-run' ? `xvfb-run → ${bin}` : bin})…`);
  // detached (POSIX): make the launch a process-group leader so cleanup can
  // SIGKILL the whole tree — xvfb-run, the Xvfb it spawns, and the dev-host.
  const proc = spawn(cmd, spawnArgs, { shell: useShell, stdio: 'ignore', detached: !IS_WIN });
  const launchFailed = new Promise((_resolve, reject) => {
    proc.on('error', (err) => reject(new Error(`failed to launch "${cmd}": ${err.message}`)));
  });
  return { proc, launchFailed };
}
