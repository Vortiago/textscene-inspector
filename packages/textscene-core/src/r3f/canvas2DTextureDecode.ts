/**
 * The 2D canvas's texture-sampling colour space, paired: a texture tag and the
 * shader define that must accompany it.
 *
 * `rendering/viewport/hdr_2d` (default `false`, `rendering_server.cpp:3771`)
 * makes Godot's default canvas sample the PLAIN (non-sRGB-typed) GPU view of
 * a texture (`texture_storage.cpp:754`), so its hardware bilinear filter
 * blends raw sRGB bytes — unlike 3D, which always asks for the sRGB-typed
 * view (`material_storage.cpp:1067,1073`) and gets a hardware decode before
 * every sample. `resources/processing/textureProcessing.ts` tags every loaded
 * texture `SRGBColorSpace` unconditionally (one shared cache entry per path,
 * `useResource.ts`), which is right for a 3D consumer and wrong for a 2D one:
 * WebGL uploads an `SRGBColorSpace` texture as `SRGB8_ALPHA8`
 * (`WebGLTextures.js`'s `getInternalFormat`), so the hardware decodes before
 * the magnification filter runs — the opposite order from Godot's canvas.
 *
 * `useCanvas2DTexture` gives a 2D-canvas consumer its own GPU-side texture
 * (a clone retagged `NoColorSpace`, keyed off the shared cache entry's
 * identity — the clone shares the decoded `Source`, so no extra CPU decode)
 * so the hardware filter blends undecoded bytes, matching Godot. That alone
 * would feed raw sRGB bytes into the rest of a pipeline that assumes linear
 * input, so `useCanvasDecodeDefines` pairs with it: it reuses three's own
 * `DECODE_VIDEO_TEXTURE` shader define (`map_fragment.glsl.js`, precedented
 * for video textures that also can't get an `SRGB8_ALPHA8` format) to decode
 * the ALREADY-FILTERED sample — moving the decode from before the hardware
 * filter to after it, which is the one degree of freedom Godot's canvas and
 * three's default 3D-oriented pipeline disagree on.
 *
 * Only the 2D-canvas's own "unlit 2D material recipe" (`meshBasicMaterial` +
 * `map`) needs this pair. A texture this module never touches (a SubViewport
 * render target, PointLight2D's cookie shader, every 3D material slot) keeps
 * sampling the shared cache entry unchanged. `useIconTexture` reaches the
 * same tag through `pinNoColorSpace` directly: the vendored theme icons come
 * from their own loader, never from the `res://` resource cache this module's
 * clone is keyed off.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { pinNoColorSpace, useUndecodedTexture } from './undecodedTexture';

// Re-exported: this module was the tag's original home, and its 2D consumers
// still reach for it here. The definition lives in `undecodedTexture.ts`
// because 3D material data maps need the same primitive.
export { pinNoColorSpace };

/**
 * A 2D-canvas-only GPU texture for a shared, cache-identity texture — the
 * undecoded view (`undecodedTexture.ts`), named for the 2D-canvas reason this
 * module's own doc gives.
 *
 * Returns `null` while there is nothing to show yet.
 */
export function useCanvas2DTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  return useUndecodedTexture(texture);
}

/** Reused across every call — `DECODE_VIDEO_TEXTURE` needs no per-consumer state. */
const DECODE_DEFINES: Readonly<Record<string, string>> = { DECODE_VIDEO_TEXTURE: '' };

/**
 * `defines` for a `meshBasicMaterial` sampling `texture` as `map`: the decode
 * three's `map_fragment` chunk applies only under `DECODE_VIDEO_TEXTURE`,
 * turned on exactly when `texture` is one of this module's `NoColorSpace`
 * retags, `pinNoColorSpace` included (never for a texture left in its own
 * space, so a SubViewport target sharing the same `<meshBasicMaterial>`
 * recipe is unaffected). Memoised so the object identity is stable across re-renders
 * with the same texture — required because R3F never bumps
 * `material.needsUpdate` on its own, so a materially different `defines`
 * value would only reach the GPU on the next-mounted material.
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
 * The retag and its matching decode, taken together — the two halves of one
 * invariant, so a caller cannot apply one without the other. Half-applied,
 * the material samples raw sRGB bytes and never decodes them, which is a
 * wrong colour ramp visible only under magnification.
 *
 * A consumer that reaches the tag by another route (`composeFrameTexture`'s
 * own `colorSpace` argument, `useIconTexture`'s `pinNoColorSpace`) needs the
 * defines half alone and calls `useCanvasDecodeDefines` directly.
 */
export function useCanvas2DMap(texture: THREE.Texture | null | undefined): Canvas2DMap {
  const canvasTexture = useCanvas2DTexture(texture);
  const defines = useCanvasDecodeDefines(canvasTexture);
  return useMemo(() => ({ texture: canvasTexture, defines }), [canvasTexture, defines]);
}
