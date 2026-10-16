/** What a frame profile publishes: one window's frames, averaged per frame. */

/** The render steps a frame profile times, in the order the overlay lists them. */
export const RENDER_STEPS = [
  'SubViewports',
  'Reflection probes',
  '2D lights',
  'Scene draw',
  'Depth prepass',
  'Shadows',
  'Fog',
  'Compositor',
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
  callsPerFrame: number;
}

export interface FrameStats {
  fps: number;
  /** The mean interval between frames. */
  frameMs: number;
  /** The mean CPU time from the frame's start to the end of its last render. */
  cpuMs: number;
  /** The mean GPU time of the frame's commands, or null while no GPU result has arrived. */
  gpuMs: number | null;
  /** False when the context offers no timer query, so every GPU time stays null. */
  hasGpuTimer: boolean;
  /** The steps that ran in the window, in `RENDER_STEPS` order, then Other. */
  steps: readonly StepStats[];
}
