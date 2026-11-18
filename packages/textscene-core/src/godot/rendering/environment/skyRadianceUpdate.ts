/**
 * When Godot bakes a sky's radiance again, and so at which render's exposure
 * (`servers/rendering/renderer_rd/environment/sky.cpp`, `update_radiance_buffers`). A render that finds
 * the sky dirty bakes its first layer at the render's own exposure (`:1275`, `:1295`), unless an
 * incremental sky is still filtering its other layers, one per render (`:1360-1368`).
 */

import { REAL_TIME_RADIANCE_SIZE } from './skyReflection';
import { vector3IsEqualApprox, type Vector3 } from '../../math/vector';

/** `Sky.process_mode` (`scene/resources/sky.h:51-56`). */
export type SkyProcessMode = 'automatic' | 'quality' | 'incremental' | 'real-time';

/** The mode a sky's radiance updates in once Godot resolves `automatic`. */
export type SkyUpdateMode = Exclude<SkyProcessMode, 'automatic'>;

/** What Godot's Automatic mode reads of a sky, its shader and its scene (`sky.cpp:1001-1012`). */
export interface AutomaticSkyInput extends SkyFrameReads {
  /** The shader reads a `LIGHTn_*` built-in. */
  readonly light: boolean;
  /** The material has a uniform that is not a sampler: `ubo_size > 0`. */
  readonly hasBufferUniforms: boolean;
  readonly radianceSize: number;
  /** The Environment's fog is on with a sun scatter above 0.001. */
  readonly fogScattersSun: boolean;
}

/** The mode Godot runs a sky of `process_mode` Automatic in (`sky.cpp:1001-1012`). */
export function automaticSkyMode(sky: AutomaticSkyInput): SkyUpdateMode {
  if ((sky.time || sky.position) && sky.radianceSize === REAL_TIME_RADIANCE_SIZE) return 'real-time';
  if (sky.light || sky.fogScattersSun || sky.hasBufferUniforms) return 'incremental';
  return 'quality';
}

/** How one sky's radiance updates: its mode, and the layers an incremental sky filters in turn. */
export interface SkyUpdatePlan {
  mode: SkyUpdateMode;
  layers: number;
}

/** A render of the sky: its exposure, and the brightness it bakes, `background_energy_multiplier` times that. */
export interface SkyRender {
  exposure: number;
  brightness: number;
}

/** One sky's radiance update, which `stepSkyRadiance` alone writes. */
export interface SkyRadianceUpdate {
  /** `processing_layer`: the next layer an incremental sky filters, 0 before the first bake. */
  processingLayer: number;
  /** `reflection.dirty`: whether a change waits for the next bake. */
  isDirty: boolean;
  /** The render that last baked the first layer, null before any did. */
  baked: SkyRender | null;
  /** `prev_time`: the `TIME` that last dirtied a sky that reads it, a float as Godot keeps it. */
  previousTime: number;
  /** `prev_position`: the camera origin that last dirtied a sky that reads `POSITION`. */
  previousPosition: Vector3;
}

/** A sky no render has drawn yet, which the first render bakes (`sky.cpp:1025-1029`). */
export function newSkyRadianceUpdate(): SkyRadianceUpdate {
  return {
    processingLayer: 0,
    isDirty: true,
    baked: null,
    previousTime: 0,
    previousPosition: { x: 0, y: 0, z: 0 },
  };
}

/** What one render did to the radiance: nothing, a bake of every layer or of layer 0, or one filter. */
export type SkyRadianceStep =
  | { readonly kind: 'none' }
  | { readonly kind: 'bake'; readonly isFirstLayerOnly: boolean }
  | { readonly kind: 'filter'; readonly layer: number };

const NO_STEP: SkyRadianceStep = { kind: 'none' };
const EVERY_LAYER: SkyRadianceStep = { kind: 'bake', isFirstLayerOnly: false };
const FIRST_LAYER: SkyRadianceStep = { kind: 'bake', isFirstLayerOnly: true };

/**
 * Runs `render` of the sky through Godot's update, `isDirtied` when the render changed what the sky
 * draws. An incremental sky bakes its first render in one frame (`sky.cpp:1265-1269`), and its other
 * layers follow from its first. The caller owns `render`, which a bake copies.
 */
export function stepSkyRadiance(
  update: SkyRadianceUpdate,
  { mode, layers }: SkyUpdatePlan,
  render: SkyRender,
  isDirtied: boolean
): SkyRadianceStep {
  if (isDirtied) update.isDirty = true;
  const isSingleFrame = mode !== 'incremental' || update.processingLayer === 0;
  if (update.isDirty && (update.processingLayer >= layers || isSingleFrame)) {
    update.baked = { ...render };
    if (mode !== 'real-time') update.processingLayer = 1;
    update.isDirty = false;
    return isSingleFrame ? EVERY_LAYER : FIRST_LAYER;
  }
  if (mode !== 'incremental' || update.processingLayer >= layers) return NO_STEP;
  update.processingLayer += 1;
  return { kind: 'filter', layer: update.processingLayer - 1 };
}

/** What a sky shader reads that changes from render to render. */
export interface SkyFrameReads {
  /** `TIME`. */
  readonly time: boolean;
  /** `POSITION`, the camera's origin. */
  readonly position: boolean;
}

/** Whether a render dirties a sky that reads its `TIME` or camera origin, as `sky.cpp:1031-1050` decides. */
export function noteSkyFrame(
  update: SkyRadianceUpdate,
  reads: SkyFrameReads,
  time: number,
  position: Vector3
): boolean {
  let isDirtied = false;
  if (reads.time && time - update.previousTime > TIME_STEP_THAT_DIRTIES) {
    update.previousTime = Math.fround(time);
    isDirtied = true;
  }
  if (reads.position && !vector3IsEqualApprox(position, update.previousPosition)) {
    const previous = update.previousPosition;
    previous.x = position.x;
    previous.y = position.y;
    previous.z = position.z;
    isDirtied = true;
  }
  return isDirtied;
}

/** Dirties the next render of a `TIME` sky: our controls stop and seek `TIME`, which Godot never does. */
export function restartSkyClock(update: SkyRadianceUpdate): void {
  update.previousTime = Number.NEGATIVE_INFINITY;
}

/** `sky.cpp:1031`: the smallest step of `TIME` that dirties the sky. */
const TIME_STEP_THAT_DIRTIES = 0.00001;
