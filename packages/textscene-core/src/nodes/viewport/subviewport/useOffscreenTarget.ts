/** A sub-viewport pass's render target, at the samples the device draws, disposed when replaced. */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useDeviceSampleCount, type ColourStorage } from '../../../r3f/deviceSampleCount';
import { createOffscreenTarget } from './offscreenViewport';

/**
 * `createOffscreenTarget` for a mounted pass, multisampled at the count closest to `requestedSamples`
 * that the device supports for the target's storage.
 */
export function useOffscreenTarget(
  width: number,
  height: number,
  name: string,
  requestedSamples: number,
  options: { colorSpace?: THREE.ColorSpace; preTonemapped?: boolean } = {}
): THREE.WebGLRenderTarget {
  const { colorSpace, preTonemapped } = options;
  const samples = useDeviceSampleCount(requestedSamples, colourStorageOf(colorSpace));
  const target = useMemo(
    () => createOffscreenTarget(width, height, name, { colorSpace, preTonemapped, samples }),
    [width, height, name, colorSpace, preTonemapped, samples]
  );
  useEffect(() => () => target.dispose(), [target]);
  return target;
}

/** Three stores an 8-bit target under an sRGB tag as SRGB8_ALPHA8 (`WebGLTextures.js:234`). */
function colourStorageOf(colorSpace: THREE.ColorSpace | undefined): ColourStorage {
  return colorSpace === THREE.SRGBColorSpace ? 'SRGB8_ALPHA8' : 'RGBA8';
}
