/**
 * Tests the capture layer's pure decisions and the preview group's teardown. The browser needs a
 * real Chromium (`pnpm test:visual`). `settleCanvas` decides which frame every measurement uses, and
 * both its failures are silent: a frame taken before the picture stopped moving, and one taken at
 * a different simulated instant from the Godot reference.
 */
import { describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import {
  CANVAS_2D_CAPTURE,
  CANVAS_2D_CHROME,
  canvas2DViewportFor,
  isUniformImage,
  settleCanvas,
  startPreview,
  writeCaptureImage,
  SETTLE_SIM_SECONDS,
} from './previewServer.mjs';
import { bootstrapScript } from '../godot-ref/run.mjs';

// The real spawn, so a test can replace one call without launching `vite preview`.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

/** A PNG whose every pixel is the same colour, as a dead GL context reads back. */
function uniformPng(width = 8, height = 8) {
  const png = new PNG({ width, height });
  png.data.fill(0);
  return PNG.sync.write(png);
}

/** The same PNG with a single pixel changed, so it carries ink. */
function inkedPng(width = 8, height = 8) {
  const png = new PNG({ width, height });
  png.data.fill(0);
  png.data[0] = 255;
  return PNG.sync.write(png);
}

/** A Playwright page/element pair reduced to what `settleCanvas` touches. */
function stubCanvas(shots) {
  let i = 0;
  const page = { waitForTimeout: async () => {} };
  const canvas = {
    calls: [],
    screenshot: async (options) => {
      canvas.calls.push(options);
      return Buffer.from(shots[Math.min(i++, shots.length - 1)]);
    },
  };
  return { page, canvas };
}

describe('settleCanvas', () => {
  it('returns the frame once two consecutive captures are byte-identical', async () => {
    const { page, canvas } = stubCanvas(['ab', 'cd', 'ef', 'ef']);
    const { buffer, reason } = await settleCanvas(page, canvas);
    expect(reason).toBeNull();
    expect(buffer.toString()).toBe('ef');
  });

  it('reports a scene that never stops moving rather than returning a frame', async () => {
    // Every capture differs, so nothing is a measurement, and the harness says so instead of
    // returning the last frame.
    let n = 0;
    const page = { waitForTimeout: async () => {} };
    const canvas = { screenshot: async () => Buffer.from(String(n++)) };
    const { buffer, reason } = await settleCanvas(page, canvas);
    expect(buffer).toBeNull();
    expect(reason).toMatch(/never settled/);
  });

  it('passes a per-scene screenshot timeout through, and omits it otherwise', async () => {
    // One SwiftShader frame of the heaviest scenes exceeds Playwright's default
    // action timeout; without the passthrough that reads as a hang, not as slow.
    const { page, canvas } = stubCanvas(['x', 'x']);
    await settleCanvas(page, canvas, { screenshotTimeout: 120000 });
    expect(canvas.calls.at(-1)).toEqual({ timeout: 120000 });

    const bare = stubCanvas(['y', 'y']);
    await settleCanvas(bare.page, bare.canvas);
    expect(bare.canvas.calls.at(-1)).toEqual({});
  });

  /**
   * Two byte-identical frames prove the picture stopped moving, not where a clock stands, so this
   * side honours only a settle of zero. A non-zero one would sample the load instant while the
   * reference sampled a later one, a mismatch neither image shows.
   */
  it('refuses a non-zero settle instead of converging and calling it that instant', async () => {
    const { page, canvas } = stubCanvas(['x', 'x']);
    await expect(settleCanvas(page, canvas, { simSeconds: 0.5 })).rejects.toThrow(
      /cannot reach it|no global clock/
    );
  });
});

/**
 * One settle number for both harnesses. With a second copy each side would stay deterministic
 * while capturing a different moment, and every later comparison would fail to notice.
 */
describe('the settle contract is shared, not duplicated', () => {
  const godotScript = (simSeconds) =>
    bootstrapScript({
      scenePath: 'res://x.tscn',
      previews: true,
      simSeconds,
      camera: null,
      lookAt: null,
      frame: false,
      sceneCamera: false,
      sceneCameraPath: null,
      mode: 'auto',
      out: '/tmp/o.png',
      boundsOut: null,
      modeOut: '/tmp/m.txt',
      fov: 70,
      fovExplicit: false,
      canvas2DSize: { width: 640, height: 360 },
    });

  it('is zero simulated seconds — the only instant the previewer can be asked for', () => {
    expect(SETTLE_SIM_SECONDS).toBe(0);
  });

  it('has the Godot side honour it before the scene exists, not after', async () => {
    // Simulated time cannot be given back, so the pause precedes instantiation. A pause below
    // add_child() still reads as frozen after it has advanced the scene a frame.
    const lines = godotScript(SETTLE_SIM_SECONDS).split('\n');
    const pause = lines.findIndex((l) => l.includes('get_tree().paused = true'));
    const instantiate = lines.findIndex((l) => l.includes('load(SCENE_PATH).instantiate()'));
    expect(pause).toBeGreaterThan(-1);
    expect(instantiate).toBeGreaterThan(pause);
  });

  it('has BOTH sides refuse the same non-zero value rather than each guessing', async () => {
    expect(() => godotScript(0.5)).toThrow(/cannot\s+reach it/);
    const { page, canvas } = stubCanvas(['x', 'x']);
    await expect(settleCanvas(page, canvas, { simSeconds: 0.5 })).rejects.toThrow();
  });

  it('keeps the convergence knobs out of the contract', () => {
    // Godot steps a fixed frame count, and ours captures until two match. Neither number is the
    // contract, so they are not aligned, and the Godot loop is named for what it does.
    expect(godotScript(SETTLE_SIM_SECONDS)).toContain('func _converge() -> void:');
    expect(godotScript(SETTLE_SIM_SECONDS)).not.toContain('func _settle() -> void:');
  });
});

/**
 * The `detached` preview group can outlive the harness, and Node runs no `finally` on a signal, so
 * an interrupted run would leave a server holding its port. `assertPortFree` detects the leftover,
 * and these pin the prevention.
 */
describe('an interrupted harness does not orphan its preview group', () => {
  /** Runs `body` in a real child node process; returns its stdout and pid. */
  function runHarness(body) {
    const file = join(tmpdir(), `preview-teardown-${process.pid}-${Math.abs(hashOf(body))}.mjs`);
    writeFileSync(file, body);
    const child = spawn(process.execPath, [file], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    return { child, out: () => out, cleanup: () => rmSync(file, { force: true }) };
  }

  const hashOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const until = async (fn, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return fn();
  };

  const exitOf = (child) =>
    new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

  /**
   * A stand-in for the real spawn: the same `detached` group shape and the teardown `startPreview`
   * registers, with no build. `keepAlive: false` unrefs the group, so the harness ends normally.
   */
  const harness = ({ keepAlive = true } = {}) => `
import { spawn } from 'node:child_process';
import { reapPreviewGroupOnExit } from ${JSON.stringify(
    new URL('./previewServer.mjs', import.meta.url).href
  )};
const proc = spawn('sh', ['-c', 'sleep 120'], { detached: true, stdio: 'ignore' });
reapPreviewGroupOnExit(proc);
console.log(String(proc.pid));
${keepAlive ? 'setTimeout(() => {}, 120000);' : 'proc.unref();'}
`;

  /** Starts the harness and waits for the pid of its preview group. */
  async function startHarness(options) {
    const h = runHarness(harness(options));
    const exited = exitOf(h.child);
    await until(() => h.out().trim().length > 0);
    return { ...h, exited, groupPid: Number(h.out().trim()) };
  }

  // The exit code, not death by the signal: `process.exit` is what runs Playwright's browser close.
  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ])('reaps the group and exits with the shell code when the harness gets %s', async (signal, code) => {
    const h = await startHarness();
    expect(alive(h.groupPid)).toBe(true);

    h.child.kill(signal);
    const exit = await h.exited;
    const reaped = await until(() => !alive(h.groupPid));
    h.cleanup();
    expect(exit).toEqual({ code, signal: null });
    expect(reaped).toBe(true);
  }, 20000);

  it('reaps the group when the harness ends normally', async () => {
    const h = await startHarness({ keepAlive: false });

    const exit = await h.exited;
    const reaped = await until(() => !alive(h.groupPid));
    h.cleanup();
    expect(exit).toEqual({ code: 0, signal: null });
    expect(reaped).toBe(true);
  }, 20000);

  it('is the teardown startPreview registers for the group it spawns', () => {
    spawn.mockReturnValueOnce({ pid: 4242 });
    const once = vi.spyOn(process, 'once').mockReturnValue(process);
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    try {
      startPreview(1);
      const handlers = Object.fromEntries(once.mock.calls);
      expect(Object.keys(handlers).sort()).toEqual(['SIGHUP', 'SIGINT', 'SIGTERM', 'exit']);
      handlers.exit();
      expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    } finally {
      once.mockRestore();
      kill.mockRestore();
    }
  });
});

/**
 * `settleCanvas` cannot tell a settled frame from a lost WebGL context, whose reads are
 * byte-identical too. A compare fails on the blank frame, but a write publishes it or makes it the
 * baseline, and nothing fails again. So the guard lives at the write.
 */
describe('a dead GL context cannot be written as a capture', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'capture-write-'));

  it('refuses a fully uniform capture rather than publishing it', () => {
    const out = join(scratch, 'refused.png');
    expect(() => writeCaptureImage(out, uniformPng(), 'unit-thing ours')).toThrow(/uniform/i);
    expect(existsSync(out)).toBe(false);
  });

  it('names what it refused, so the operator knows which image to look at', () => {
    expect(() => writeCaptureImage(join(scratch, 'named.png'), uniformPng(), 'unit-thing ours')).toThrow(
      /unit-thing ours/
    );
  });

  it('writes a capture that carries ink, byte for byte', () => {
    const out = join(scratch, 'written.png');
    const buffer = inkedPng();
    writeCaptureImage(out, buffer, 'unit-thing ours');
    expect(readFileSync(out).equals(buffer)).toBe(true);
  });

  it('treats a single differing pixel as ink — the guard is for dead frames, not sparse ones', () => {
    expect(isUniformImage(inkedPng(64, 64))).toBe(false);
    expect(isUniformImage(uniformPng(64, 64))).toBe(true);
  });

  it('calls a one-pixel image uniform, since it can never carry a difference', () => {
    expect(isUniformImage(uniformPng(1, 1))).toBe(true);
  });

  it('catches a non-black uniform frame too — a dead context reads back the clear colour', () => {
    const png = new PNG({ width: 8, height: 8 });
    for (let i = 0; i < png.data.length; i += 4) {
      [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]] = [30, 60, 90, 255];
    }
    expect(isUniformImage(PNG.sync.write(png))).toBe(true);
  });
});

describe('canvas2DViewportFor', () => {
  /**
   * The stage lays a project's `display/window/size/viewport_*` rect out at 1:1, so a rect larger
   * than the default window hangs past the edge and `findCanvas2DFrame` rejects the capture.
   * 1280x720 misses by five pixels.
   */
  it('grows the window so a frame larger than the default still fits the stage', () => {
    const viewport = canvas2DViewportFor({ width: 1280, height: 720 });
    expect(viewport.width - CANVAS_2D_CHROME.width).toBeGreaterThanOrEqual(1280);
    expect(viewport.height - CANVAS_2D_CHROME.height).toBeGreaterThanOrEqual(720);
  });

  /**
   * Existing 2D goldens were captured through the default window. Widening it
   * for every scene would relayout the stage under them, so a frame that
   * already fits must keep the exact window they were shot in.
   */
  it('keeps the default window for a frame that already fits', () => {
    expect(canvas2DViewportFor(CANVAS_2D_CAPTURE)).toEqual(CANVAS_2D_CAPTURE.viewport);
    expect(canvas2DViewportFor(null)).toEqual(CANVAS_2D_CAPTURE.viewport);
  });
});
