/**
 * When Godot bakes a sky's radiance again, and so at which render's exposure
 * (`servers/rendering/renderer_rd/environment/sky.cpp`, `update_radiance_buffers`). A render that finds
 * the sky dirty bakes its first layer at the render's own exposure (`:1275`, `:1295`), unless an
 * incremental sky is still filtering its other layers, one per render (`:1360-1368`).
 */

/** `Sky.process_mode` (`scene/resources/sky.h:51-56`). */
export type SkyProcessMode = 'automatic' | 'quality' | 'incremental' | 'real-time';

/** The mode a sky's radiance updates in once Godot resolves `automatic`. */
export type SkyUpdateMode = Exclude<SkyProcessMode, 'automatic'>;

/**
 * The mode a sky of `processMode` updates in. Godot resolves `automatic` to incremental for a shader
 * that holds uniforms (`sky.cpp:1001-1012`), which every built-in sky material does, and none of
 * them reads `TIME` or `POSITION`.
 */
export function skyUpdateMode(processMode: SkyProcessMode): SkyUpdateMode {
  return processMode === 'automatic' ? 'incremental' : processMode;
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
