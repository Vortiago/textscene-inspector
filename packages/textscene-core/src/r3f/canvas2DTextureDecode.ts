/**
 * The 2D canvas's texture colour space: a `NoColorSpace` retag and the define
 * that multiplies its texels in sRGB, for the unlit 2D recipe (`meshBasicMaterial` + `map`) alone.
 * A canvas-content SubViewport target holds sRGB bytes already, so it takes the define with no
 * retag. A PointLight2D cookie and every 3D material slot keep sampling the shared cache entry.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useUploadedClone } from './tiledUpload/useTiledUpload';
import { drawnClone } from './drawnClone';
import { CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';
import { holdsSrgbBytes } from './srgbByteTextures';
import {
  canvasItemCloneSampler,
  useResolvedTextureSampler,
  type CanvasItemTextureSampler,
} from './canvasItemTextureSampler';

/**
 * A 2D-only clone of a cached texture, retagged `NoColorSpace`, sharing its `Source`, and sampled by
 * the item's `sampler`. The canvas filters raw sRGB bytes, where 3D samples the sRGB view
 * (`material_storage.cpp:1067,1073`). Returns `null` with nothing to show.
 */
export function useCanvas2DTexture(
  texture: THREE.Texture | null | undefined,
  sampler: CanvasItemTextureSampler
): THREE.Texture | null {
  // The cache tags every texture `SRGBColorSpace` (`textureProcessing.ts`), which
  // WebGL uploads as `SRGB8_ALPHA8` (`WebGLTextures.js`), decoding before the filter.
  // A consumer that overrides the sampler, such as a tiled `TextureRect`, clones again.
  // The sampler states the wrap too: a file-loaded entry arrives clamped (ADR-0044), but a producer
  // can hand over Repeat, such as a seamless `NoiseTexture2D`, and Godot's item default is Disabled.
  const undecoded = useMemo(
    () => (texture ? drawnClone(texture, canvasItemCloneSampler(sampler)) : null),
    [texture, sampler]
  );
  return useUploadedClone(undecoded);
}

/** `useCanvas2DTexture` with the sampler the owning Control's painter inherits. */
export function useOwnerCanvas2DTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  return useCanvas2DTexture(texture, useResolvedTextureSampler());
}

/**
 * `defines` for a `meshBasicMaterial` sampling `texture` as `map`, set for a `NoColorSpace` retag
 * and for a texture that holds sRGB bytes. A define reaches the GPU only on a newly mounted
 * material, which `materialProgramInputs` arranges, so the identity is memoised.
 */
export function useCanvasSrgbDefines(
  texture: THREE.Texture | null | undefined
): Record<string, string> | undefined {
  return useMemo(() => {
    if (!texture) return undefined;
    const samplesSrgbBytes = texture.colorSpace === THREE.NoColorSpace || holdsSrgbBytes(texture);
    return samplesSrgbBytes ? CANVAS_SRGB_DEFINES : undefined;
  }, [texture]);
}
