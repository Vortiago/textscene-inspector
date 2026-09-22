/**
 * Unit tests for the capture layer's pure decisions.
 *
 * Most of `previewServer.mjs` is browser and process lifecycle, answerable only
 * by a real Chromium (`pnpm test:visual`). What IS testable with a stub page is
 * `settleCanvas`'s contract, and that is the piece worth pinning: it decides
 * WHICH frame every measurement in this repo is taken from. Its two failure
 * modes are silent — a frame accepted before the picture stopped moving, and a
 * frame taken at a different simulated instant from the Godot reference it will
 * be compared against — so neither shows up in the image it corrupts.
 */
import { describe, expect, it } from 'vitest';
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
  writeCaptureImage,
  SETTLE_SIM_SECONDS,
} from './previewServer.mjs';
import { bootstrapScript } from '../godot-ref/run.mjs';

/** A PNG whose every pixel is the same colour — what a dead GL context reads back as. */
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
    // Every capture differs, so nothing here is a measurement — the harness has
    // to say so instead of handing back whichever frame the loop stopped on.
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
   * The settle contract, from this side. Two byte-identical frames prove the
   * picture stopped moving; they prove nothing about WHERE a clock stands, so
   * this side can only honour a settle of zero. Answering a non-zero one with
   * the convergence heuristic anyway would sample the load instant while the
   * reference sampled a later one — a mismatch invisible in both images.
   */
  it('refuses a non-zero settle instead of converging and calling it that instant', async () => {
    const { page, canvas } = stubCanvas(['x', 'x']);
    await expect(settleCanvas(page, canvas, { simSeconds: 0.5 })).rejects.toThrow(
      /cannot reach it|no global clock/
    );
  });
});

/**
 * One contract, one number, both harnesses. A second copy of the settle amount
 * is the specific failure this guards: each side would stay internally
 * consistent and deterministic while capturing a different moment, so every
 * ours-vs-Godot number measured afterwards compares two different pictures and
 * nothing fails.
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
    // Simulated time cannot be given back once it has run, so the pause has to
    // precede instantiation; a pause moved below add_child() still reads as
    // "frozen" while having already advanced the scene by a frame.
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
    // Godot steps a fixed frame count, we screenshot until two match. Neither
    // number is the contract, and a future reader must not "align" them: the
    // Godot side's own loop is named for what it does.
    expect(godotScript(SETTLE_SIM_SECONDS)).toContain('func _converge() -> void:');
    expect(godotScript(SETTLE_SIM_SECONDS)).not.toContain('func _settle() -> void:');
  });
});

/**
 * The preview server is spawned `detached`, which is what lets one signal reach
 * the whole `shell`→`pnpm`→`vite preview` group — and equally what lets that
 * group outlive the harness. Every harness calls `killPreviewGroup` from a
 * `finally`, and Node runs no `finally` when the process is signalled, so an
 * interrupted run leaves a server holding its port with nothing left to reap
 * it. `assertPortFree` already DETECTS the leftover; these pin the prevention.
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

  // A stand-in for the real spawn: same `detached` group shape, no build.
  const harness = () => `
import { spawn } from 'node:child_process';
import { registerPreviewGroupTeardown } from ${JSON.stringify(
    new URL('./previewServer.mjs', import.meta.url).href
  )};
const proc = spawn('sh', ['-c', 'sleep 120'], { detached: true, stdio: 'ignore' });
registerPreviewGroupTeardown(proc);
console.log(String(proc.pid));
setTimeout(() => {}, 120000);
`;

  it('reaps the group when the harness is interrupted with SIGINT', async () => {
    const h = runHarness(harness());
    await until(() => h.out().trim().length > 0);
    const groupPid = Number(h.out().trim());
    expect(alive(groupPid)).toBe(true);

    h.child.kill('SIGINT');
    const reaped = await until(() => !alive(groupPid));
    h.cleanup();
    expect(reaped).toBe(true);
  }, 20000);

  it('reaps the group when the harness is terminated with SIGTERM', async () => {
    const h = runHarness(harness());
    await until(() => h.out().trim().length > 0);
    const groupPid = Number(h.out().trim());

    h.child.kill('SIGTERM');
    const reaped = await until(() => !alive(groupPid));
    h.cleanup();
    expect(reaped).toBe(true);
  }, 20000);
});

/**
 * The write path's own blind spot.
 *
 * `settleCanvas` accepts a capture once two consecutive screenshots are
 * byte-identical, and it cannot tell a settled frame from a DEAD one — two
 * reads of a lost WebGL context are byte-identical too. On a comparing
 * harness that is harmless: a blank frame diffs hugely and fails. On a
 * WRITING harness it is not, because the blank image becomes the published
 * picture (or the baseline every future compare is measured against), and
 * nothing ever fails again. The guard has to live at the write, which is the
 * only place that distinction still exists.
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
   * The 2D capture used a fixed browser viewport sized for this repo's own
   * corpus, and a project whose `display/window/size/viewport_*` is larger
   * simply overflowed the stage — the frame is laid out at 1:1, so it hangs
   * past the edge and `findCanvas2DFrame` rejects the whole capture. 1280x720
   * is the commonest project rect there is and misses by five pixels.
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
