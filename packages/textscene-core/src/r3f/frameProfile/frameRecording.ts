import type * as THREE from 'three';
import type { DrawSource, DrawStats, FrameRecording, GpuSpread, StepKey } from './frameStats.js';
import type { RecordedDevice } from './recordedDevice.js';
import { add, NS_PER_MS, statsOf, WindowSums } from './windowSums.js';

export interface RecordOptions {
  /** 120 by default: two seconds at 60 frames a second. */
  frames?: number;
  /** Times each draw call on the GPU too, at the cost of a query per draw. False by default. */
  draws?: boolean;
}

const DEFAULT_FRAMES = 120;

/** A recording with no frame for this long fails: a hidden view or a background tab draws none. */
const STALLED_RECORDING_MS = 5000;

/** The frames and draw sums of one recording, which a profile fills and finishes. */
export class Recording {
  readonly sums = new WindowSums();
  readonly drawGpuNs = new Map<DrawSource, number>();
  readonly drawCalls = new Map<DrawSource, number>();
  /** Each GPU frame's time, and each draw source's time in the frames that drew it, in ns. */
  private readonly frameGpuNs: number[] = [];
  private readonly drawFrameGpuNs = new Map<DrawSource, number[]>();
  /** GPU frames that timed draws: a frame drawn while no recording timed draws carries none. */
  private drawTimedGpuFrames = 0;
  /** Written only by `restartStallTimer`, `finish` and `fail`. */
  private stallTimer: ReturnType<typeof setTimeout> | undefined;
  readonly frames: number;
  readonly timesDraws: boolean;
  readonly result: Promise<FrameRecording>;
  /** Written only by `finish` and `fail`: the profile drops a settled recording at the next frame. */
  isSettled = false;
  private resolve!: (recording: FrameRecording) => void;
  private reject!: (error: Error) => void;

  constructor({ frames = DEFAULT_FRAMES, draws = false }: RecordOptions) {
    if (!Number.isInteger(frames) || frames < 2) {
      throw new Error(`expected a whole count of 2 frames or more, got ${frames}`);
    }
    this.frames = frames;
    this.timesDraws = draws;
    this.result = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.restartStallTimer();
  }

  /** Fails the recording unless another frame arrives within `STALLED_RECORDING_MS`. */
  restartStallTimer(): void {
    clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(
      () => this.fail(`no frame in ${STALLED_RECORDING_MS} ms, so the view stopped drawing`),
      STALLED_RECORDING_MS
    );
  }

  isComplete(): boolean {
    return this.sums.frames >= this.frames;
  }

  /** Adds one GPU frame: its whole time, and each draw source's time in it. */
  addGpuFrame(frameNs: number, drawNs: ReadonlyMap<DrawSource, number>): void {
    this.frameGpuNs.push(frameNs);
    if (!this.timesDraws || drawNs.size === 0) return;
    this.drawTimedGpuFrames += 1;
    for (const [source, ns] of drawNs) {
      const frames = this.drawFrameGpuNs.get(source);
      if (frames) frames.push(ns);
      else this.drawFrameGpuNs.set(source, [ns]);
    }
  }

  finish(hasGpuTimer: boolean, device: RecordedDevice): void {
    this.settle();
    const stats = statsOf(this.sums, { hasGpuTimer });
    this.resolve({
      ...stats,
      timings: stats.timings!,
      gpuSpread: spreadOf(this.frameGpuNs),
      frames: this.sums.frames,
      device,
      ...(this.timesDraws && { draws: this.drawStats() }),
    });
  }

  fail(reason: string): void {
    this.settle();
    this.reject(new Error(`expected ${this.frames} recorded frames, got ${this.sums.frames}: ${reason}`));
  }

  private settle(): void {
    clearTimeout(this.stallTimer);
    this.isSettled = true;
  }

  private drawStats(): DrawStats[] {
    const draws = [...this.drawCalls].map(([source, calls]) => ({
      ...source,
      gpuMs: this.drawGpuMsPerFrame(this.drawGpuNs.get(source) ?? 0),
      gpuSpread: spreadOf(this.drawFrameGpuNs.get(source) ?? []),
      callsPerFrame: calls / this.sums.frames,
    }));
    return draws.sort((a, b) => (b.gpuMs ?? 0) - (a.gpuMs ?? 0));
  }

  private drawGpuMsPerFrame(ns: number): number | null {
    return this.drawTimedGpuFrames > 0 ? ns / NS_PER_MS / this.drawTimedGpuFrames : null;
  }
}

/** The median and the 10th and 90th percentiles of `ns`, in ms, or null for no frames. */
function spreadOf(ns: readonly number[]): GpuSpread | null {
  if (ns.length === 0) return null;
  const sorted = [...ns].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.round(fraction * (sorted.length - 1))]! / NS_PER_MS;
  return { medianMs: at(0.5), lowMs: at(0.1), highMs: at(0.9) };
}

/** One draw source per step, object and material, so a recording's sums key on identity. */
export class DrawSources {
  private readonly sources = new Map<string, DrawSource>();

  of(step: StepKey, object: THREE.Object3D, material: THREE.Material): DrawSource {
    const objectName = nameOf(object);
    const materialName = material.name || material.type;
    const key = `${step}\n${objectName}\n${materialName}`;
    let source = this.sources.get(key);
    if (!source) {
      source = { step, object: objectName, material: materialName };
      this.sources.set(key, source);
    }
    return source;
  }
}

/** Adds one call from `source` to each recording that times draws. */
export function countDraw(recordings: readonly Recording[], source: DrawSource): void {
  for (const recording of recordings) if (recording.timesDraws) add(recording.drawCalls, source, 1);
}

/** Adds a draw's GPU time to each recording that times draws. */
export function addDrawGpuTime(recordings: readonly Recording[], source: DrawSource, ns: number): void {
  for (const recording of recordings) if (recording.timesDraws) add(recording.drawGpuNs, source, ns);
}

/** Brackets each draw, shadows too, at `renderBufferDirect` (r187 `WebGLRenderer.js:2182`). */
export function timeEachDraw(
  renderer: THREE.WebGLRenderer,
  begin: (object: THREE.Object3D, material: THREE.Material) => void,
  end: () => void
): () => void {
  const draw = renderer.renderBufferDirect;
  const timed: typeof draw = (camera, scene, geometry, material, object, group) => {
    begin(object, material);
    try {
      draw.call(renderer, camera, scene, geometry, material, object, group);
    } finally {
      end();
    }
  };
  renderer.renderBufferDirect = timed;
  return () => {
    // A hook installed over this one calls it, so it stays: its `begin` and `end` gate themselves.
    if (renderer.renderBufferDirect === timed) renderer.renderBufferDirect = draw;
  };
}

function nameOf(object: THREE.Object3D): string {
  for (let named: THREE.Object3D | null = object; named; named = named.parent) {
    if (named.name) return named.name;
  }
  return object.type;
}
