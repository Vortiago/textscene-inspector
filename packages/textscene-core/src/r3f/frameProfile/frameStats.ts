/** What a frame profile publishes: one window's frames, averaged per frame. */

import type { RecordedDevice } from './recordedDevice.js';

/** The render steps a frame profile times, in the order the overlay lists them. */
export const RENDER_STEPS = [
  'SubViewports',
  'Reflection probes',
  '2D lights',
  'Scene draw',
  'Depth prepass',
  'Normal-roughness prepass',
  'Screen-space ambient occlusion',
  'Screen-space reflection',
  'Shadows',
  'Fog',
  'Compositor',
  'Canvas groups',
  'Canvas copy',
] as const;

export type RenderStep = (typeof RENDER_STEPS)[number];

/** The steps whose work includes the canvas's own draw of its scene, as the compositor's scene pass. */
export const WRAPS_CANVAS_DRAW: ReadonlySet<RenderStep> = new Set<RenderStep>(['Compositor']);

/** A render step, or the frame's own time outside every step. */
export type StepKey = RenderStep | 'Other';

export interface StepStats {
  step: StepKey;
  /** The step's own CPU time per frame, without the steps nested in it. */
  cpuMs: number;
  /** The step's own GPU time per frame, or null while no GPU result has arrived. */
  gpuMs: number | null;
  /** How many times the step ran per frame. */
  runsPerFrame: number;
  /** The step's own draw calls per frame, without those of the steps nested in it. */
  drawCallsPerFrame: number;
}

export interface FrameStats {
  fps: number;
  /** The mean interval between frames. */
  frameMs: number;
  /** The mean CPU time from the frame's start to the end of its last render. */
  cpuMs: number;
  /** The mean draw calls of the frame, over every render in it. */
  drawCallsPerFrame: number;
  /** The mean objects of Godot's editor monitor: the canvas draw's surfaces, and its shadow passes' draws. */
  objectsPerFrame: number;
  /** The mean primitives of Godot's editor monitor: those of the surfaces the canvas draw draws. */
  primitivesPerFrame: number;
  /** The GPU and per-step times, present only while `show.performance` is on: they cost a query per step. */
  timings?: FrameTimings;
}

export interface FrameTimings {
  /** The mean GPU time of the frame's commands, or null while no GPU result has arrived. */
  gpuMs: number | null;
  /** False when the context offers no timer query, so every GPU time stays null. */
  hasGpuTimer: boolean;
  /** The mean texture uploads of the frame: each `texImage` and `texSubImage` call of the context. */
  uploadsPerFrame: number;
  /**
   * The steps that ran in the window or had a GPU result arrive in it, in `RENDER_STEPS` order,
   * then Other.
   */
  steps: readonly StepStats[];
}

/** Where one draw call or clear came from: the step it ran in, its object and its material. */
export interface DrawSource {
  step: StepKey;
  /** The name of the object or of its nearest named ancestor, else the object's type. `Clear` for a clear. */
  object: string;
  /** The material's name, else its type. For a clear, the bound target's texture name, or `canvas`. */
  material: string;
}

/** A GPU time over a recording's frames: the median and the 10th and 90th percentiles, in ms. */
export interface GpuSpread {
  medianMs: number;
  lowMs: number;
  highMs: number;
}

export interface DrawStats extends DrawSource {
  /** The GPU time per frame of every call from this source, or null while no GPU result has arrived. */
  gpuMs: number | null;
  /** Over the frames that drew this source, or null while no GPU result has arrived. */
  gpuSpread: GpuSpread | null;
  callsPerFrame: number;
}

/** What a recording of one canvas answers: the overlay's numbers, averaged over its own frames. */
export interface FrameRecording extends FrameStats {
  frames: number;
  device: RecordedDevice;
  timings: FrameTimings;
  /** The whole frame's GPU time, or null while no GPU result has arrived. */
  gpuSpread: GpuSpread | null;
  /** Present when the recording timed each draw, slowest first. Each draw costs its own GPU query. */
  draws?: readonly DrawStats[];
}
