import { canvasColorSpaceOf, type CanvasColorSpace } from '../canvasColorSpace';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types';

/** Linear under `use_hdr_2d`, and a canvas over a 3D world follows it, as both write one target. */
export function viewportCanvasColorSpace(
  properties: Pick<SubViewportProperties, 'use_hdr_2d'>
): CanvasColorSpace {
  return canvasColorSpaceOf(properties.use_hdr_2d);
}
