/**
 * The texture a Node2D canvas item draws, as one hook: `useTexture2D` for the slot, and the
 * sampler its CanvasTexture draws with. A node passes `canvasTexture` on to `CanvasItem2D`, which
 * lights the item through the maps. `canvasItemTexture.conformance.test.ts` fails a canvas item
 * that loads its texture any other way, so a new one cannot forget the maps.
 */

import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
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

/** A canvas item samples the plain view of a ViewportTexture. */
const CANVAS_ITEM_VIEW = 'plain';

export function useCanvasItemTexture(
  props: Pick<Node2DProperties, 'texture_filter' | 'texture_repeat'>,
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  isHeldLocally?: boolean
): CanvasItemTextureResult {
  const { canvasTexture: slot, ...drawn } = useTexture2D(
    ref,
    externalResources,
    internalResources,
    CANVAS_ITEM_VIEW,
    isHeldLocally
  );
  const sampler = useCanvasTextureSampler(useNode2DTextureSampler(props), slot?.texture);
  return { ...drawn, sampler, canvasTexture: slot && { slot, sampler } };
}
