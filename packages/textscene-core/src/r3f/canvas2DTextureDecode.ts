/**
 * The 2D canvas's texture colour space: a `NoColorSpace` retag and the define
 * that multiplies its texels in sRGB, for the unlit 2D recipe (`meshBasicMaterial` + `map`) alone.
 * A canvas-content SubViewport target holds sRGB bytes already, so it takes the define with no
 * retag. A PointLight2D cookie and every 3D material slot state their own sampler (`textureView.ts`).
 */
import * as THREE from 'three';
import { useOwnedTextureView } from './useTextureView';
import { CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';
import { holdsSrgbBytes } from './srgbByteTextures';
import {
  canvasItemViewSampler,
  useResolvedTextureSampler,
  type CanvasItemTextureSampler,
} from './canvasItemTextureSampler';

/**
 * A 2D-only view of a cached texture, retagged `NoColorSpace`, and sampled by the item's `sampler`.
 * The canvas filters raw sRGB bytes, where 3D samples the sRGB view (`material_storage.cpp:1067,1073`).
 * Always a clone, since a sprite writes its frame's window on it and R3F retags a shared source of
 * the same tag. Returns `null` with nothing to show.
 */
export function useCanvas2DTexture(
  texture: THREE.Texture | null | undefined,
  sampler: CanvasItemTextureSampler
): THREE.Texture | null {
  // The cache tags every texture `SRGBColorSpace` (`textureProcessing.ts`), which
  // WebGL uploads as `SRGB8_ALPHA8` (`WebGLTextures.js`), decoding before the filter.
  // The sampler states the wrap too: a file-loaded entry arrives clamped (ADR-0044), but a producer
  // can hand over Repeat, such as a seamless `NoiseTexture2D`, and Godot's item default is Disabled.
  return useOwnedTextureView(texture, canvasItemViewSampler(sampler));
}

/** `useCanvas2DTexture` with the sampler the owning Control's painter inherits. */
export function useOwnerCanvas2DTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  return useCanvas2DTexture(texture, useResolvedTextureSampler());
}

/**
 * The `map` and `defines` of a `meshBasicMaterial` that samples `texture`: the sRGB-multiply define
 * is set for a `NoColorSpace` retag and for a texture that holds sRGB bytes. A define reaches the GPU
 * only on a newly mounted material, which `materialProgramInputs` arranges. Spread it into the
 * material's props, so no painter states the map without its define.
 */
export function canvasMapProps(texture: THREE.Texture | null | undefined): {
  map: THREE.Texture | null;
  defines: Record<string, string> | undefined;
} {
  if (!texture) return { map: null, defines: undefined };
  const samplesSrgbBytes = texture.colorSpace === THREE.NoColorSpace || holdsSrgbBytes(texture);
  return { map: texture, defines: samplesSrgbBytes ? CANVAS_SRGB_DEFINES : undefined };
}
