/**
 * The texture a Node2D canvas item draws, as one hook: `useTexture2D` for the slot, and the
 * sampler its CanvasTexture draws with. A node passes `canvasTexture` on to `CanvasItem2D`, which
 * lights the item through the maps. `canvasItemTexture.conformance.test.ts` fails a canvas item
 * that loads its texture any other way, so a new one cannot forget the maps.
 */

import { useMemo } from 'react';
import type { Node2DProperties } from '../nodes/base/node2d/types';
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
  ...load: Parameters<typeof useTexture2D>
): CanvasItemTextureResult {
  const { canvasTexture: slot, ...drawn } = useTexture2D(...load);
  const sampler = useCanvasTextureSampler(useNode2DTextureSampler(props), slot?.texture);
  const canvasTexture = useMemo(() => slot && { slot, sampler }, [slot, sampler]);
  return { ...drawn, sampler, canvasTexture };
}
