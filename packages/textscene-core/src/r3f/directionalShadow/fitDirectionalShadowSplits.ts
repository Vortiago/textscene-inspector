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
  directionalShadowSplitOffsets,
  directionalShadowSplitRange,
  directionalShadowSplitTextureSize,
  type DirectionalShadowFade,
} from '../../godot/directionalShadow.js';
import {
  fitDirectionalShadowBox,
  viewSlice,
  type DirectionalShadowBox,
  type DirectionalShadowFitInput,
} from './fitDirectionalShadowBox.js';

export interface DirectionalShadowSplitFitInput extends Omit<DirectionalShadowFitInput, 'shadowMapSize'> {
  /** The whole atlas's size. Each split counts its texels against its own share of it. */
  atlasSize: number;
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
}

/** Null when a split gets no finite box. The caller then leaves the light's shadow as it is. */
export function fitDirectionalShadowSplits(
  input: DirectionalShadowSplitFitInput
): DirectionalShadowSplits | null {
  const { declaration } = input;
  const { splitCount } = declaration;
  const blends = blendsSplits(splitCount, declaration.blendSplits);
  const distances = directionalShadowSplitDistances(viewSlice(input), splitCount, declaration.splitOffsets);
  const splitInput = { ...input, shadowMapSize: directionalShadowSplitTextureSize(splitCount, input.atlasSize) };

  const boxes: DirectionalShadowBox[] = [];
  for (let split = 0; split < splitCount; split++) {
    const box = fitDirectionalShadowBox(splitInput, directionalShadowSplitRange(distances, split, blends));
    if (!box) return null;
    boxes.push(box);
  }

  const lastSplit = splitCount - 1;
  const slots = directionalShadowSplitOffsets(distances, splitCount).map((splitEnd, slot): SplitSlot => {
    const box = boxes[Math.min(slot, lastSplit)]!;
    const blendStart = blends && slot < lastSplit ? directionalShadowBlendStart(splitEnd) : NO_BLEND;
    return [splitEnd, box.bias, box.normalBias, blendStart];
  });
  return { boxes, fade: directionalShadowFade(distances[splitCount]!, declaration.fadeStart), slots };
}
