/**
 * The frame profile: the CPU time, GPU time and draw calls of each render step on one renderer,
 * averaged over a window of frames and published. While no profile runs on a renderer, a step marker
 * is one map lookup and records nothing.
 */

import type * as THREE from 'three';
import { GpuTimer } from './gpuTimer.js';
import {
  RENDER_STEPS,
  type DrawSource,
  type FrameRecording,
  type FrameStats,
  type RenderStep,
  type StepKey,
} from './frameStats.js';
import { add, statsOf, WindowSums } from './windowSums.js';
import { recordedDevice } from './recordedDevice.js';
import { countTextureUploads } from './textureUploads.js';
import {
  addDrawGpuTime,
  countDraw,
  DrawSources,
  Recording,
  timeEachDraw,
  type RecordOptions,
} from './frameRecording.js';

/**
 * Twice a second: the digits stay readable, and the overlay re-renders rarely enough to leave the
 * frames it measures alone.
 */
const STATS_WINDOW_MS = 500;

/** What a GPU query times: one step's own work, or one draw call in it. */
interface Segment {
  readonly step: StepKey;
  readonly draw: DrawSource | null;
}

const STEP_SEGMENTS = new Map<StepKey, Segment>(
  [...RENDER_STEPS, 'Other' as const].map((step) => [step, { step, draw: null }])
);

/** Written only by `start` and `Profile.stop`. A Map, not a WeakMap, so `recordFrames` reaches each. */
const profiles = new Map<THREE.WebGLRenderer, Profile>();

/** Starts timing `step` on `renderer`, when a profile runs there and a frame is open. */
export function beginStep(renderer: THREE.WebGLRenderer, step: RenderStep): void {
  profiles.get(renderer)?.beginStep(step);
}

/** Stops timing `step` on `renderer`, when it is the innermost open step. */
export function endStep(renderer: THREE.WebGLRenderer, step: RenderStep): void {
  profiles.get(renderer)?.endStep(step);
}

/** The innermost step open on `renderer`, or null with none open or no profile running. */
export function innermostStep(renderer: THREE.WebGLRenderer): RenderStep | null {
  return profiles.get(renderer)?.innermostStep() ?? null;
}

/** Opens the view's own draw of its scene, whose shadow pass draws count as objects, in the open frame. */
export function openViewDraw(renderer: THREE.WebGLRenderer): void {
  profiles.get(renderer)?.openViewDraw();
}

/** Runs `draw`, a shadow pass, whose draw calls count as objects while the view's own draw is open. */
export function countShadowDraws(renderer: THREE.WebGLRenderer, draw: () => void): void {
  const drawCallsAtStart = renderer.info.render.calls;
  draw();
  profiles.get(renderer)?.countShadowDraws(renderer.info.render.calls - drawCallsAtStart);
}

/** Closes the view's draw, with the objects and primitives of the surfaces it drew. */
export function closeViewDraw(renderer: THREE.WebGLRenderer, objects: number, primitives: number): void {
  profiles.get(renderer)?.closeViewDraw(objects, primitives);
}

type Publish = (stats: FrameStats) => void;

/**
 * Starts a profile on `renderer` that calls `publish` once a window of frames has passed. The caller
 * marks each frame with `beginFrame` and `endFrame`, and owns `stop`. A second start on the same
 * renderer replaces the first.
 */
export function startFrameCount(
  renderer: THREE.WebGLRenderer,
  publish: Publish,
  now: () => number = () => performance.now()
): FrameProfile {
  return start(renderer, () => new Profile(renderer, publish, now));
}

/** Stops the running profile first, so the new one reads the renderer as its owner left it. */
function start(renderer: THREE.WebGLRenderer, create: () => Profile): Profile {
  profiles.get(renderer)?.stop();
  const profile = create();
  profiles.set(renderer, profile);
  return profile;
}

/** A running profile. Its starter marks each frame and stops it. */
export interface FrameProfile {
  /** Opens a frame at `timestamp`, the animation frame's time. */
  beginFrame(timestamp: number): void;
  /** Closes the frame, with every step still open in it. */
  endFrame(): void;
  /** Adds the GPU and step timings to each window from now, without restarting the count. */
  startTimings(): void;
  stopTimings(): void;
  stop(): void;
}

/** The overlay's numbers over `options.frames` frames, per view with Performance on. Rejects with none on. */
export async function recordFrames(options: RecordOptions = {}): Promise<FrameRecording[]> {
  const timed = [...profiles.values()].filter((profile) => profile.isTimed);
  if (timed.length === 0) throw new Error('expected a view with Performance on in its View menu, got none');
  return Promise.all(timed.map((profile) => profile.record(options)));
}

class Profile implements FrameProfile {
  private sums = new WindowSums();
  /** Written only by `record`: recordings that start at the next frame. */
  private readonly starting: Recording[] = [];
  /** Filled from `starting` at each frame's start: a finished recording leaves at once, a failed one then. */
  private recordings: Recording[] = [];
  private readonly drawSources = new DrawSources();
  /** Hooked at the first recording that times draws, and unhooked at `stop`. */
  private unhookDraws: (() => void) | null = null;
  /** Whether a recording in this frame times draws: the hook does nothing while none does. */
  private isTimingDraws = false;
  /** The `beginFrame` timestamp the window opened at, null before the first frame. */
  private windowStart: number | null = null;
  private lastTimestamp: number | null = null;
  private isFrameOpen = false;
  private frameStart = 0;
  /** The open steps, innermost last. */
  private readonly openSteps: RenderStep[] = [];
  private isViewDrawOpen = false;
  /** The step whose own time runs now, and the clock reading and draw count it started at. */
  private current: StepKey = 'Other';
  private segmentStart = 0;
  private segmentDrawCalls = 0;
  /** Written only by `startTimings` and `stopTimings`. */
  private gpu: GpuTimer<Segment> | null = null;
  private stopCountingUploads: (() => void) | null = null;
  /** The open frame's texture uploads, counted while the timings run. */
  private frameUploads = 0;
  /** The GPU frame `collect` hands over: written by `addGpuTime`, cleared by `endGpuFrame`. */
  private gpuFrameNs = 0;
  private readonly gpuFrameDrawNs = new Map<DrawSource, number>();
  /** Written only by `startTimings` and `stopTimings`: `recordFrames` reads it. */
  isTimed = false;
  private readonly wasAutoReset: boolean;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly publish: Publish,
    private readonly now: () => number
  ) {
    // three zeroes the count at each render's start (r187 `WebGLRenderer.js:1744`), so a frame of several
    // renders keeps only its last one's. The profile zeroes it per frame instead.
    this.wasAutoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
  }

  beginFrame(timestamp: number): void {
    if (profiles.get(this.renderer) !== this) return;
    if (this.isFrameOpen) this.endFrame();
    if (this.lastTimestamp !== null) {
      const intervalMs = timestamp - this.lastTimestamp;
      this.addToEach((sums) => {
        sums.intervals += 1;
        sums.intervalMs += intervalMs;
      });
    }
    if (this.gpu) {
      const frames = this.gpu.collect(this.addGpuTime, this.endGpuFrame);
      this.addToEach((sums) => (sums.gpuFrames += frames));
    }
    this.recordings = [...this.recordings, ...this.starting.splice(0)].filter(
      (recording) => !recording.isSettled
    );
    this.isTimingDraws = this.recordings.some((recording) => recording.timesDraws);
    this.windowStart ??= timestamp;
    this.lastTimestamp = timestamp;
    this.isFrameOpen = true;
    this.frameStart = this.now();
    this.renderer.info.reset();
    this.current = 'Other';
    this.segmentStart = this.frameStart;
    this.segmentDrawCalls = 0;
    this.frameUploads = 0;
    this.gpu?.switchTo(STEP_SEGMENTS.get('Other')!);
  }

  endFrame(): void {
    if (!this.isFrameOpen) return;
    this.endSegment();
    this.gpu?.endFrame();
    this.openSteps.length = 0;
    this.isViewDrawOpen = false;
    this.isFrameOpen = false;
    const cpuMs = this.now() - this.frameStart;
    const drawCalls = this.renderer.info.render.calls;
    this.addToEach((sums) => {
      sums.frames += 1;
      sums.cpuMs += cpuMs;
      sums.drawCalls += drawCalls;
      sums.uploads += this.frameUploads;
    });
    if (this.lastTimestamp! - this.windowStart! >= STATS_WINDOW_MS) this.publishWindow();
    this.finishCompleteRecordings();
    for (const recording of this.recordings) recording.restartStallTimer();
  }

  beginStep(step: RenderStep): void {
    if (!this.isFrameOpen) return;
    if (this.isTimed) this.addToEach((sums) => add(sums.stepRuns, step, 1));
    this.openSteps.push(step);
    this.switchTo(step);
  }

  endStep(step: RenderStep): void {
    if (this.openSteps.at(-1) !== step) return;
    this.openSteps.pop();
    this.switchTo(this.openSteps.at(-1) ?? 'Other');
  }

  countShadowDraws(drawCalls: number): void {
    if (this.isViewDrawOpen) this.addToEach((sums) => (sums.objects += drawCalls));
  }

  openViewDraw(): void {
    this.isViewDrawOpen = this.isFrameOpen;
  }

  closeViewDraw(objects: number, primitives: number): void {
    if (!this.isViewDrawOpen) return;
    this.isViewDrawOpen = false;
    this.addToEach((sums) => {
      sums.objects += objects;
      sums.primitives += primitives;
    });
  }

  innermostStep(): RenderStep | null {
    return this.openSteps.at(-1) ?? null;
  }

  startTimings(): void {
    if (this.isTimed) return;
    this.isTimed = true;
    this.segmentStart = this.now();
    this.segmentDrawCalls = this.renderer.info.render.calls;
    const context = this.renderer.getContext() as WebGL2RenderingContext;
    this.gpu = GpuTimer.create(context);
    this.stopCountingUploads = countTextureUploads(context, () => (this.frameUploads += 1));
  }

  stopTimings(): void {
    this.failRecordings('Performance turned off');
    this.isTimed = false;
    this.gpu?.dispose();
    this.gpu = null;
    this.stopCountingUploads?.();
    this.stopCountingUploads = null;
  }

  stop(): void {
    this.isFrameOpen = false;
    this.failRecordings('the view closed its profile');
    this.stopTimings();
    // A replaced profile's second stop leaves the renderer to the profile that replaced it.
    if (profiles.get(this.renderer) !== this) return;
    this.unhookDraws?.();
    this.renderer.info.autoReset = this.wasAutoReset;
    profiles.delete(this.renderer);
  }

  /** Starts a recording at the next frame. Its frames count in the published windows too. */
  record(options: RecordOptions): Promise<FrameRecording> {
    const recording = new Recording(options);
    this.starting.push(recording);
    if (recording.timesDraws) {
      this.unhookDraws ??= timeEachDraw(this.renderer, {
        beginDraw: this.beginDraw,
        beginClear: this.beginClear,
        end: this.endDraw,
      });
    }
    return recording.result;
  }

  private readonly beginDraw = (object: THREE.Object3D, material: THREE.Material): void => {
    if (!this.timesThisDraw()) return;
    this.beginSource(this.drawSources.of(this.current, object, material));
  };

  private readonly beginClear = (): void => {
    if (!this.timesThisDraw()) return;
    this.beginSource(this.drawSources.ofClear(this.current, this.renderer.getRenderTarget()));
  };

  private timesThisDraw(): boolean {
    return this.isTimingDraws && this.isFrameOpen;
  }

  private beginSource(draw: DrawSource): void {
    countDraw(this.recordings, draw);
    this.gpu?.switchTo({ step: this.current, draw });
  }

  private readonly endDraw = (): void => {
    if (this.timesThisDraw()) this.gpu?.switchTo(STEP_SEGMENTS.get(this.current)!);
  };

  /** Adds a frame's numbers to the published window and to each recording. */
  private addToEach(update: (sums: WindowSums) => void): void {
    update(this.sums);
    for (const recording of this.recordings) update(recording.sums);
  }

  private finishCompleteRecordings(): void {
    const complete = this.recordings.filter((recording) => recording.isComplete());
    if (complete.length === 0) return;
    this.recordings = this.recordings.filter((recording) => !recording.isComplete());
    const device = recordedDevice(this.renderer);
    for (const recording of complete) recording.finish(this.gpu !== null, device);
    this.isTimingDraws = this.recordings.some((recording) => recording.timesDraws);
  }

  private failRecordings(reason: string): void {
    for (const recording of [...this.starting.splice(0), ...this.recordings.splice(0)])
      recording.fail(reason);
    this.isTimingDraws = false;
  }

  /** Ends the running step's segment and starts `next`'s. */
  private switchTo(next: StepKey): void {
    if (next === this.current) return;
    this.endSegment();
    this.current = next;
    this.gpu?.switchTo(STEP_SEGMENTS.get(next)!);
  }

  // Untimed, the steps only nest: `innermostStep` still reads them, and no sum grows.
  private endSegment(): void {
    if (!this.isTimed) return;
    const time = this.now();
    const cpuMs = time - this.segmentStart;
    this.segmentStart = time;
    const drawCalls = this.renderer.info.render.calls;
    const segmentDrawCalls = drawCalls - this.segmentDrawCalls;
    this.segmentDrawCalls = drawCalls;
    this.addToEach((sums) => {
      add(sums.stepCpuMs, this.current, cpuMs);
      add(sums.stepDrawCalls, this.current, segmentDrawCalls);
    });
  }

  private readonly addGpuTime = ({ step, draw }: Segment, ns: number): void => {
    this.addToEach((sums) => {
      sums.gpuNs += ns;
      add(sums.stepGpuNs, step, ns);
    });
    this.gpuFrameNs += ns;
    if (!draw) return;
    addDrawGpuTime(this.recordings, draw, ns);
    add(this.gpuFrameDrawNs, draw, ns);
  };

  private readonly endGpuFrame = (): void => {
    for (const recording of this.recordings) recording.addGpuFrame(this.gpuFrameNs, this.gpuFrameDrawNs);
    this.gpuFrameNs = 0;
    this.gpuFrameDrawNs.clear();
  };

  private publishWindow(): void {
    this.publish(statsOf(this.sums, this.isTimed ? { hasGpuTimer: this.gpu !== null } : null));
    this.sums = new WindowSums();
    this.windowStart = this.lastTimestamp;
  }
}
