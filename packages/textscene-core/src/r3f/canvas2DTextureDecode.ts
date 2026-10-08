/**
 * The 2D canvas's texture colour space: a `NoColorSpace` retag and the define
 * that multiplies its texels in sRGB, for the unlit 2D recipe (`meshBasicMaterial` + `map`) alone.
 * A SubViewport target, a PointLight2D cookie and every 3D material slot keep
 * sampling the shared cache entry.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useUploadedClone } from './tiledUpload/useTiledUpload';
import { pinNoColorSpace, undecodedClone } from './undecodedTexture';
import { CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';

// Re-exported for the 2D consumers. It lives in `undecodedTexture.ts`, since 3D
// material data maps need it too.
export { pinNoColorSpace };

/**
 * A 2D-only clone of a cached texture, retagged `NoColorSpace`, sharing its
 * `Source`. With `hdr_2d` off (`rendering_server.cpp:3771`), Godot's canvas filters
 * raw sRGB bytes from the plain view (`texture_storage.cpp:754`), where 3D samples
 * the sRGB view (`material_storage.cpp:1067,1073`). Returns `null` with nothing to show.
 */
export function useCanvas2DTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  // The cache tags every texture `SRGBColorSpace` (`textureProcessing.ts`), which
  // WebGL uploads as `SRGB8_ALPHA8` (`WebGLTextures.js`), decoding before the filter.
  // A consumer that overrides the sampler, such as a tiled `TextureRect`, clones again.
  const undecoded = useMemo(() => {
    if (!texture) return null;
    const clone = undecodedClone(texture);
    // A canvas item's `texture_repeat` resolves to the viewport default, disabled
    // (`scene/main/viewport.h:420`, `scene/main/viewport.cpp:4009`,
    // `scene/main/canvas_item.cpp:1686-1694`). A file-loaded entry arrives clamped
    // (ADR-0044), but a producer can hand over Repeat, such as a seamless
    // `NoiseTexture2D`. So the clamp is stated here, not inherited.
    clone.wrapS = THREE.ClampToEdgeWrapping;
    clone.wrapT = THREE.ClampToEdgeWrapping;
    return clone;
  }, [texture]);
  return useUploadedClone(undecoded);
}

/**
 * `defines` for a `meshBasicMaterial` sampling `texture` as `map`, set only for a
 * `NoColorSpace` retag. A define reaches the GPU only on a newly mounted material,
 * which `materialProgramInputs` arranges, so the identity is memoised.
 */
export function useCanvasSrgbDefines(
  texture: THREE.Texture | null | undefined
): Record<string, string> | undefined {
  return useMemo(
    () => (texture?.colorSpace === THREE.NoColorSpace ? CANVAS_SRGB_DEFINES : undefined),
    [texture]
  );
}
