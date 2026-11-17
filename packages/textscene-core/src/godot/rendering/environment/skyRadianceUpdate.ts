/**
 * When Godot bakes a sky's radiance again, and so at which render's exposure
 * (`servers/rendering/renderer_rd/environment/sky.cpp`, `update_radiance_buffers`). A render that finds
 * the sky dirty bakes its first layer at the render's own exposure (`:1275`, `:1295`), unless an
 * incremental sky is still filtering its other layers, one per render (`:1360-1368`).
 */

import { REAL_TIME_RADIANCE_SIZE } from './skyReflection';

/** `Sky.process_mode` (`scene/resources/sky.h:51-56`). */
export type SkyProcessMode = 'automatic' | 'quality' | 'incremental' | 'real-time';

/** The mode a sky's radiance updates in once Godot resolves `automatic`. */
export type SkyUpdateMode = Exclude<SkyProcessMode, 'automatic'>;

/** What Godot's Automatic mode reads of a sky, its shader and its scene (`sky.cpp:1001-1012`). */
export interface AutomaticSkyInput {
  /** The shader reads `TIME` or `POSITION`. */
  readonly timeOrPosition: boolean;
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
  if (sky.timeOrPosition && sky.radianceSize === REAL_TIME_RADIANCE_SIZE) return 'real-time';
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
}

/** A sky no render has drawn yet, which the first render bakes (`sky.cpp:1025-1029`). */
export function newSkyRadianceUpdate(): SkyRadianceUpdate {
  return { processingLayer: 0, isDirty: true, baked: null };
}

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
): void {
  if (isDirtied) update.isDirty = true;
  const isSingleFrame = mode !== 'incremental' || update.processingLayer === 0;
  if (update.isDirty && (update.processingLayer >= layers || isSingleFrame)) {
    update.baked = { ...render };
    if (mode !== 'real-time') update.processingLayer = 1;
    update.isDirty = false;
  } else if (mode === 'incremental' && update.processingLayer < layers) {
    update.processingLayer += 1;
  }
}
