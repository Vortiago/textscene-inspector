/**
 * The texture a Node2D canvas item draws, as one hook: `useTexture2D` for the slot, and the
 * sampler its CanvasTexture draws with. A node passes `canvasTexture` on to `CanvasItem2D`, which
 * lights the item through the maps. A tile run, which lights its own mesh, mounts a
 * `CanvasItemSurfaceSource` for it. `canvasItemTexture.conformance.test.ts` fails a canvas item
 * that loads its texture any other way, so a new one cannot forget the maps.
 */

import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { ScopedReference } from '../resources/reading';
import { useTexture2D, type CanvasTextureSlot, type Texture2DResult } from '../resources/useTexture2D';
import {
  useCanvasTextureSampler,
  useNode2DTextureSampler,
  type CanvasItemTextureSampler,
} from './canvasItemTextureSampler';

/** A CanvasTexture and the sampler it draws with, which its normal and specular maps share. */
export interface CanvasItemTexture {
  slot: CanvasTextureSlot;
  sampler: CanvasItemTextureSampler;
}

interface CanvasItemTextureResult extends Omit<Texture2DResult, 'canvasTexture'> {
  /** The sampler the texture draws with: the CanvasTexture's own filter and repeat win over the item's. */
  sampler: CanvasItemTextureSampler;
  /** Undefined while the slot names no CanvasTexture. */
  canvasTexture: CanvasItemTexture | undefined;
}

export function useCanvasItemTexture(
  props: Pick<Node2DProperties, 'texture_filter' | 'texture_repeat'>,
  reference: ScopedReference | null
): CanvasItemTextureResult {
  return useCanvasItemTextureSampledBy(useNode2DTextureSampler(props), reference);
}

/** `useCanvasItemTexture` for an item whose effective sampler is already resolved, as a tile layer's is. */
export function useCanvasItemTextureSampledBy(
  itemSampler: CanvasItemTextureSampler,
  reference: ScopedReference | null
): CanvasItemTextureResult {
  // No view: the slot samples the view of its canvas's colour space.
  const { canvasTexture: slot, ...drawn } = useTexture2D(reference);
  const sampler = useCanvasTextureSampler(itemSampler, slot?.texture);
  return { ...drawn, sampler, canvasTexture: slot && { slot, sampler } };
}
