/**
 * How `texture_filter` and `texture_repeat` pass down the canvas item chain: PARENT_NODE takes the
 * nearest concrete ancestor value (`canvas_item.cpp:1625-1699`). Pure, so the canvas item pass reads it.
 */
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../godot/scene/canvasItem';

/** What the ancestors name, `undefined` where none does. */
export interface AmbientTextureSampler {
  filter: number | undefined;
  repeat: number | undefined;
}

/** No ancestor names either property, so the viewport default applies. */
export const ROOT_TEXTURE_SAMPLER: AmbientTextureSampler = { filter: undefined, repeat: undefined };

/**
 * One property's resolution rule, shared by filter and repeat: an unnamed own value or the
 * property's PARENT_NODE defers to the ambient. A concrete one wins, and the item hands it down.
 */
function resolveInheritedSamplerValue(
  own: number | undefined,
  ambient: number | undefined,
  parentNode: number
): number | undefined {
  return own === undefined || own === parentNode ? ambient : own;
}

/** `own` laid over `ambient`: the sampler a node's descendants inherit, still with gaps where none names one. */
export function inheritTextureSampler(
  own: AmbientTextureSampler,
  ambient: AmbientTextureSampler
): AmbientTextureSampler {
  return {
    filter: resolveInheritedSamplerValue(own.filter, ambient.filter, CanvasItemTextureFilter.PARENT_NODE),
    repeat: resolveInheritedSamplerValue(own.repeat, ambient.repeat, CanvasItemTextureRepeat.PARENT_NODE),
  };
}
