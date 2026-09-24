/**
 * The extension dev-host as a process: it finds a VS Code binary, launches it (under xvfb when
 * there is no X server), waits for its CDP endpoint and kills the whole tree afterwards, so no
 * orphaned Electron holds the user-data-dir and no capture shoots the wrong window.
 */

import { spawn, execSync } from 'node:child_process';
import { rmSync, existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { SWIFTSHADER_GL_ARGS } from '../../browser.mjs';
import { THROWAWAY_USER_SETTINGS } from '../../../vscode/userSettings.mjs';
import { HEADLESS, IS_LINUX, IS_WIN, sleep } from './platform.mjs';
import { EXT, PORT, UD, VSCODE_CACHE, WS } from './paths.mjs';

/** Kills only our dev-host instances, matched by the user-data-dir marker, never the user's VS Code. */
export function killStaleHost(udMarker) {
  try {
    if (IS_WIN) {
      execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Code.exe'\\" | Where-Object { $_.CommandLine -like '*${udMarker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
        { stdio: 'ignore' }
      );
      return;
    }
    // List first, then signal from node: `pkill -f <marker>` would match its own shell, whose
    // command line holds the marker, and kill the caller. By the signal, that shell has exited
    // and its pid fails with ESRCH.
    const matched = execSync(`pgrep -f -- ${JSON.stringify(udMarker)} || true`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().split('\n').filter(Boolean).map(Number);
    for (const pid of matched) {
      if (pid === process.pid || pid === process.ppid) continue;
      // SIGKILL, like the Windows -Force above: the dev-host's Electron main catches SIGTERM and
      // shuts down slowly under xvfb, so a plain signal leaks orphans.
      try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  } catch { /* nothing matched */ }
}

/**
 * Kills an orphan that holds the CDP port, which would block every later run. A dev-host helper
 * (dconf, a GTK shim) inherits the socket, outlives its host and has no user-data-dir marker. Only
 * a re-parented process (`PPid: 1`) on this exact port is touched: nothing a user runs listens there.
 */
export function killPortOrphan(port) {
  if (IS_WIN) return; // No /proc to confirm the re-parenting on.
  let holders;
  try {
    holders = execSync(`ss -ltnpH 'sport = :${port}' 2>/dev/null || true`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch { return; }
  for (const [, pid] of holders.matchAll(/pid=(\d+)/g)) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      if (!/^PPid:\s*1$/m.test(status)) continue; // still owned by a live parent
      const name = /^Name:\s*(.+)$/m.exec(status)?.[1] ?? '?';
      console.log(`[vscode] freeing port ${port} from orphaned ${name} (pid ${pid})`);
      process.kill(Number(pid), 'SIGKILL');
    } catch { /* gone, or not ours to read */ }
  }
}

/**
 * Seeds the throwaway user-data-dir before the dev-host reads it. The window comes up 1440x900 on
 * the 1920x1080 Xvfb screen whatever `window.newWindowDimensions` says: Electron has no
 * `Browser.setWindowBounds` and Xvfb no window manager. The editor split (`widenPreview`) is the lever.
 */
export function seedUserData(userDataDir) {
  const userDir = `${userDataDir}/User`;
  mkdirSync(userDir, { recursive: true });
  writeFileSync(`${userDir}/settings.json`, JSON.stringify(THROWAWAY_USER_SETTINGS, null, 2));
}

/** Kills the launched process group: xvfb-run, Xvfb and the dev-host it wraps. */
export function killProcessTree(proc) {
  try {
    // A negative PID targets the group that `detached` made (pgid === proc.pid). It reaches the Xvfb,
    // which has no user-data-dir marker, and xvfb-run's cleanup trap does not fire on a killed parent.
    if (IS_WIN) proc.kill();
    else if (proc.pid) process.kill(-proc.pid, 'SIGKILL'); // No pid means the launch never started.
  } catch { /* already gone */ }
}

/** Remove the throwaway user-data-dir, retrying while a dying host still holds a lock. */
export async function rmRetry(dir) {
  for (let i = 0; i < 12; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { /* Locked: the host is dying */ }
    await sleep(500);
  }
}

/** Platform executable inside a downloaded VS Code dir (mirrors @vscode/test-electron). */
function execInDir(dir) {
  if (IS_WIN) return `${dir}/Code.exe`;
  if (process.platform === 'darwin') return `${dir}/Visual Studio Code.app/Contents/MacOS/Electron`;
  return `${dir}/code`;
}

/** Numeric version tuple from a `vscode-<platform>-<a.b.c>` cache dir, with -Infinity when missing. */
function cacheDirVersion(dir) {
  const m = /(\d+)\.(\d+)\.(\d+)\b/.exec(dir);
  return m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]) : -Infinity;
}

/** The newest finished VS Code build in the shared cache, or null. */
function cachedVscode() {
  if (!existsSync(VSCODE_CACHE)) return null;
  const dirs = readdirSync(VSCODE_CACHE)
    .filter((d) => d.startsWith('vscode-') && existsSync(`${VSCODE_CACHE}/${d}/is-complete`))
    // Highest semver first: a lexical sort ranks 1.99.0 above 1.128.1.
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

/** Resolves a VS Code binary: $VSCODE_BIN, then PATH (not headless), the shared cache, a download. */
async function resolveVscodeBin() {
  if (process.env.VSCODE_BIN) return { bin: process.env.VSCODE_BIN, viaPath: false };
  // A PATH `code` is a launcher that detaches Electron and returns, so xvfb-run would tear down
  // Xvfb before the webview paints. The cached build stays in the foreground.
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
function buildLaunchCommand(bin, viaPath) {
  const vscodeArgs = [
    `--extensionDevelopmentPath=${EXT}`,
    `--user-data-dir=${UD}`,
    `--remote-debugging-port=${PORT}`,
    '--new-window', '--disable-workspace-trust', '--disable-updates',
    '--skip-welcome', '--skip-release-notes',
  ];
  if (IS_LINUX) {
    // The cached chrome-sandbox is not setuid, so @vscode/test-electron passes these sandbox flags
    // under xvfb too. SwiftShader GL makes the webview's WebGL canvas paint headless.
    vscodeArgs.push('--no-sandbox', '--disable-gpu-sandbox', ...SWIFTSHADER_GL_ARGS);
  }
  vscodeArgs.push(WS);

  let cmd = bin;
  let spawnArgs = vscodeArgs;
  if (HEADLESS) {
    cmd = 'xvfb-run';
    // -a picks a free display, and GL needs 24-bit depth. The window comes up 1440x900 inside the
    // screen (`seedUserData`). The -screen string is one argv element, passed verbatim to getopt.
    spawnArgs = ['-a', '--server-args=-screen 0 1920x1080x24', bin, ...vscodeArgs];
  }
  // On Windows a `code` resolved from PATH is code.cmd, which needs a shell to run.
  return { cmd, spawnArgs, useShell: IS_WIN && viaPath };
}

/**
 * Spawns the dev-host. Returns the child and a promise that rejects on a failed launch: a missing
 * launcher emits an async 'error' with no pid, which as an uncaughtException would skip cleanup.
 * A late error after CDP is up settles the resolved race harmlessly.
 */
export async function launchDevHost() {
  const { bin, viaPath } = await resolveVscodeBin();
  const { cmd, spawnArgs, useShell } = buildLaunchCommand(bin, viaPath);
  console.log(`[vscode] launching dev-host (${cmd === 'xvfb-run' ? `xvfb-run → ${bin}` : bin})…`);
  // On POSIX `detached` makes the launch a process-group leader, so cleanup can kill the whole
  // tree: xvfb-run, its Xvfb and the dev-host.
  const proc = spawn(cmd, spawnArgs, { shell: useShell, stdio: 'ignore', detached: !IS_WIN });
  const launchFailed = new Promise((_resolve, reject) => {
    proc.on('error', (err) => reject(new Error(`failed to launch "${cmd}": ${err.message}`)));
  });
  return { proc, launchFailed };
}
