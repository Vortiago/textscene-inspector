/**
 * Rasterises a decoded `GradientTexture2D` to a `THREE.DataTexture`, synchronously: the texture
 * and its Gradient describe it fully. `rasterizedTexture` owns the cache and the pin key. React
 * consumers read it through `useTexture2D`.
 */

import type * as THREE from 'three';
import { rasterizedTexture, type ProceduralTextureResolution } from '../rasterizedTexture';
import type { GradientTexture2DSource } from '../texture2d/types';
import { rasterizeGradientTexture2D } from './build';

/** Null with no gradient, for which the texture gets no image. */
export function gradientTexture2D(
  source: GradientTexture2DSource
): ProceduralTextureResolution<THREE.DataTexture> | null {
  const { texture, gradient } = source;
  if (!gradient) return null;
  return rasterizedTexture(source, 'GradientTexture2D', () => rasterizeGradientTexture2D(texture, gradient));
}
