/**
 * The noise and the colour ramp a NoiseTexture2D or NoiseTexture3D names, resolved to the values
 * its build reads, so a worker job needs nothing but them. A reference is a SubResource, or an
 * ExtResource once its `.tres` has loaded.
 */

import type { TscnInternalResource } from '../../parser/types';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import { resolveReferencedResource } from '../resolveReference';
import type { LoadedFile } from '../scopedResource';
import { decodeFastNoiseLite } from '../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../noise/fastnoiselite/types';
import { decodeGradientResource } from './gradienttexture2d/decode';
import type { Gradient } from './gradienttexture2d/types';

interface NoiseSources {
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

/** The `noise` and `color_ramp` references of a NoiseTexture2D or NoiseTexture3D's properties. */
export function noiseRefsOf(properties: Record<string, string>): NoiseRefs {
  return { noise: properties.noise ?? null, colorRamp: properties.color_ramp ?? null };
}

export interface NoiseRefs {
  noise: string | null;
  colorRamp: string | null;
}

/**
 * The resources the refs name. One parse answers a reference with one object, so a plan built from
 * these objects is stale exactly when one of them is another object.
 */
export function noiseSourceResources(
  refs: NoiseRefs,
  pools: SceneResources,
  loadedFile: LoadedFile
): Array<TscnInternalResource | null> {
  return [refs.noise, refs.colorRamp].map((ref) =>
    resolveReferencedResource(ref ?? undefined, pools, loadedFile)
  );
}

/**
 * Null for an unusable `noise`, for which `_generate_texture` returns no image
 * (`noise_texture_2d.cpp:159-161`, `noise_texture_3d.cpp:146-148`). Only FastNoiseLite generates.
 * Another Noise subclass would be its own slice behind the same `noise` slot.
 */
export function resolveNoiseSources(
  refs: NoiseRefs,
  pools: SceneResources,
  loadedFile: LoadedFile
): NoiseSources | null {
  const [noise, colorRamp] = noiseSourceResources(refs, pools, loadedFile);
  if (!noise || noise.type !== 'FastNoiseLite') return null;
  return { noise: decodeFastNoiseLite(noise.data), colorRamp: decodeGradientResource(colorRamp ?? null) };
}
