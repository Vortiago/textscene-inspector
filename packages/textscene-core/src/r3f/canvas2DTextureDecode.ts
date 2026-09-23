/**
 * The 2D canvas's texture colour space: a `NoColorSpace` retag and the define
 * that decodes it, for the unlit 2D recipe (`meshBasicMaterial` + `map`) alone.
 * A SubViewport target, a PointLight2D cookie and every 3D material slot keep
 * sampling the shared cache entry.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { pinNoColorSpace, useUndecodedTexture } from './undecodedTexture';

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
  const undecoded = useUndecodedTexture(texture);
  return useMemo(() => {
    if (!undecoded) return null;
    // A canvas item's `texture_repeat` resolves to the viewport default, disabled
    // (`scene/main/viewport.h:420`, `scene/main/viewport.cpp:4009`,
    // `scene/main/canvas_item.cpp:1686-1694`). The cache loads REPEAT for 3D
    // (`FLAG_USE_TEXTURE_REPEAT`), so a Polygon2D's overrunning UVs would tile.
    undecoded.wrapS = THREE.ClampToEdgeWrapping;
    undecoded.wrapT = THREE.ClampToEdgeWrapping;
    undecoded.needsUpdate = true;
    return undecoded;
  }, [undecoded]);
}

/**
 * three's `DECODE_VIDEO_TEXTURE` (`map_fragment.glsl.js`) decodes the sample after
 * the filter, as Godot's canvas does. It needs no per-consumer state, so one object serves.
 */
const DECODE_DEFINES: Readonly<Record<string, string>> = { DECODE_VIDEO_TEXTURE: '' };

/**
 * `defines` for a `meshBasicMaterial` sampling `texture` as `map`, set only for a
 * `NoColorSpace` retag. A define reaches the GPU only on a newly mounted material,
 * which `materialProgramInputs` arranges, so the identity is memoised.
 */
export function useCanvasDecodeDefines(
  texture: THREE.Texture | null | undefined
): Record<string, string> | undefined {
  return useMemo(
    () => (texture?.colorSpace === THREE.NoColorSpace ? DECODE_DEFINES : undefined),
    [texture]
  );
}

/** A 2D-canvas `map` and the `defines` that decode it, as one value. */
export interface Canvas2DMap {
  /** The `NoColorSpace` clone, or `null` while there is nothing to show. */
  texture: THREE.Texture | null;
  /** Spread onto the sampling material's `defines`. */
  defines: Record<string, string> | undefined;
}

/**
 * The retag and its decode together: half-applied, the material never decodes its
 * raw sRGB bytes. `composeFrameTexture` and `useIconTexture`, whose icons have their
 * own loader, tag by another route and call `useCanvasDecodeDefines` alone.
 */
export function useCanvas2DMap(texture: THREE.Texture | null | undefined): Canvas2DMap {
  const canvasTexture = useCanvas2DTexture(texture);
  const defines = useCanvasDecodeDefines(canvasTexture);
  return useMemo(() => ({ texture: canvasTexture, defines }), [canvasTexture, defines]);
}
