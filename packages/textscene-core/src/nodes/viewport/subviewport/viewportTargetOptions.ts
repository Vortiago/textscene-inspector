import { canvasColorSpaceOf, type CanvasColorSpace } from '../../../r3f/canvasColorSpace';
import type { SubViewportProperties } from './types';

/**
 * The colour space of a sub-viewport's canvas: linear under `use_hdr_2d`. A canvas drawn over a 3D
 * world follows it, since that world's tonemap pass writes the same HDR target.
 */
export function viewportCanvasColorSpace(
  properties: Pick<SubViewportProperties, 'use_hdr_2d'>
): CanvasColorSpace {
  return canvasColorSpaceOf(properties.use_hdr_2d);
}
