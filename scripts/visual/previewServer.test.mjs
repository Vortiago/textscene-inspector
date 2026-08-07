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
import { settleCanvas, SETTLE_SIM_SECONDS } from './previewServer.mjs';
import { bootstrapScript } from '../godot-ref/run.mjs';

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
