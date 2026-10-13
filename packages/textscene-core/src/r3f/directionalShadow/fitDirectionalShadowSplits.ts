/**
 * The boxes of a directional light that draws Godot's parallel splits, fitted to the viewing
 * camera split by split as `_light_instance_setup_directional_shadow` fits them
 * (`renderer_scene_cull.cpp:2168-2353`), and the per-split values the shader reads. Pure: it reads
 * THREE maths and writes nothing.
 */

import {
  blendsSplits,
  directionalShadowBlendStart,
  directionalShadowFade,
  directionalShadowSplitDistances,
  directionalShadowSplitEnds,
  directionalShadowSplitRange,
  directionalShadowSplitTextureSize,
  directionalShadowSplitAtlasRect,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  type DirectionalShadowAtlasRect,
  type DirectionalShadowFade,
} from '../../godot/directionalShadow.js';
import {
  directionalShadowBoxFitter,
  viewSlice,
  type DirectionalShadowBox,
  type DirectionalShadowFitInput,
} from './fitDirectionalShadowBox.js';

export interface DirectionalShadowSplitFitInput extends Omit<DirectionalShadowFitInput, 'shadowMapSize'> {
  /** The light's share of Godot's atlas. Each split counts its texels against its own part of it. */
  lightRect: DirectionalShadowAtlasRect;
}

/**
 * The blend start of a slot that does not blend into the next split. A real blend start is negative
 * for a negative split offset, which Godot's setter keeps, so the marker sits far below any depth.
 */
export const NO_BLEND = -1e30;

/**
 * One slot of the shader's per-split data, `sunShadowCascade[slot]`. The split end is Godot's
 * `shadow_split_offsets[slot]`, the depth bias is in normalised depth of the split's own box, and
 * the normal bias is in world units. The last drawn split never blends, and the lookup never reads
 * slot 3's blend start.
 */
export type SplitSlot = [splitEnd: number, depthBias: number, normalBias: number, blendStart: number];

/**
 * One slot of a light with an angular distance: Godot's `shadow_range_begin[slot]` and `uv_scale`
 * (`light_storage.cpp:727-731`), the box's light side in world units and one over its size, in
 * units of the atlas. Godot measures from a receiver its depth bias moved towards the light
 * (`scene_forward_clustered.glsl:2304`, `:2321`), so the range start moves away by that bias.
 */
export type SoftSplitSlot = [rangeBegin: number, uvScaleX: number, uvScaleY: number];

export interface DirectionalShadowSplits {
  /** One box per drawn split, nearest first. */
  boxes: DirectionalShadowBox[];
  /**
   * The light's fade, over the far end of its last split (`light_storage.cpp:752-754`). The shader
   * applies it to whichever split a fragment samples.
   */
  fade: DirectionalShadowFade;
  /** Always four: a light with two splits repeats its last split in the slots past it. */
  slots: SplitSlot[];
  /** Always four, as `slots` are, for the blocker search. */
  softSlots: SoftSplitSlot[];
}

/** Null when a split gets no finite box. The caller then leaves the light's shadow as it is. */
export function fitDirectionalShadowSplits(
  input: DirectionalShadowSplitFitInput
): DirectionalShadowSplits | null {
  const { declaration } = input;
  const { splitCount } = declaration;
  const blends = blendsSplits(splitCount, declaration.blendSplits);
  const distances = directionalShadowSplitDistances(viewSlice(input), splitCount, declaration.splitOffsets);
  const fitSplit = directionalShadowBoxFitter({
    ...input,
    shadowMapSize: directionalShadowSplitTextureSize(splitCount, input.lightRect),
  });

  const boxes: DirectionalShadowBox[] = [];
  for (let split = 0; split < splitCount; split++) {
    const box = fitSplit(directionalShadowSplitRange(distances, split, blends));
    if (!box) return null;
    boxes.push(box);
  }

  const lastSplit = splitCount - 1;
  const slots = directionalShadowSplitEnds(distances, splitCount).map((splitEnd, slot): SplitSlot => {
    const box = boxes[Math.min(slot, lastSplit)]!;
    const blendStart = blends && slot < lastSplit ? directionalShadowBlendStart(splitEnd) : NO_BLEND;
    return [splitEnd, box.bias, box.normalBias, blendStart];
  });
  const softSlots = slots.map((_, slot) => softSplitSlot(boxes, slot, input.lightRect));
  return {
    boxes,
    fade: directionalShadowFade(distances[splitCount]!, declaration.fadeStart),
    slots,
    softSlots,
  };
}

/** The soft slot of `slot`, which past the last split repeats it, as its matrix does. */
function softSplitSlot(
  boxes: readonly DirectionalShadowBox[],
  slot: number,
  lightRect: DirectionalShadowAtlasRect
): SoftSplitSlot {
  const split = Math.min(slot, boxes.length - 1);
  const box = boxes[split]!;
  const rect = directionalShadowSplitAtlasRect(boxes.length, split, lightRect);
  const depthBiasInWorld = box.bias * (box.far - box.near);
  return [
    box.rangeBegin + depthBiasInWorld,
    rect.width / DIRECTIONAL_SHADOW_SIZE_DEFAULT / (box.right - box.left),
    rect.height / DIRECTIONAL_SHADOW_SIZE_DEFAULT / (box.top - box.bottom),
  ];
}
