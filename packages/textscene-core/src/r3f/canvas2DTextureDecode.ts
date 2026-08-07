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
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Permanently pins `texture.colorSpace` to `NoColorSpace`, immune to
 * `@react-three/fiber`'s OWN automatic sRGB tagging: `applyProps`
 * (`@react-three/fiber`'s `events-*.js`, the `colorMaps.includes(key)`
 * branch — `colorMaps = ['map', 'emissiveMap', 'sheenColorMap',
 * 'specularColorMap', 'envMap']`) force-rewrites ANY 8-bit RGBA texture
 * assigned to one of those JSX props back to `SRGBColorSpace`, on every
 * commit, whenever the R3F root is not in `linear` mode — which this
 * codebase's `<Canvas>`s are not (`rootState.linear` defaults `false`, never
 * overridden). That auto-tagging is invisible everywhere else in this
 * codebase because every OTHER texture already wants `SRGBColorSpace`; a
 * deliberately `NoColorSpace` `map` is the first thing here it fights. A
 * plain assignment loses that fight silently on the very next commit — this
 * pins the getter so the fight has no effect, rather than depending on
 * REACT's effect ordering to win it back after the fact.
 */
export function pinNoColorSpace(texture: THREE.Texture): THREE.Texture {
  Object.defineProperty(texture, 'colorSpace', {
    get: () => THREE.NoColorSpace,
    set: () => {
      // Discard `@react-three/fiber`'s own reassignment attempt — see the
      // function doc comment above.
    },
    configurable: true,
    enumerable: true,
  });
  return texture;
}

/**
 * A 2D-canvas-only GPU texture for a shared, cache-identity texture: a clone
 * retagged `NoColorSpace` (pinned, see `pinNoColorSpace`), memoised on the
 * input's identity and disposed on replacement/unmount. `useResource` hands
 * out the SAME cached `THREE.Texture` to every consumer of a path, so
 * mutating its `colorSpace` in place would flip it for every 3D consumer of
 * that same path too — the clone is what keeps this 2D-only.
 *
 * Returns `null` while there is nothing to show yet.
 */
export function useCanvas2DTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  const cloned = useMemo(() => {
    if (!texture) return null;
    const clone = texture.clone();
    pinNoColorSpace(clone);
    clone.needsUpdate = true;
    return clone;
  }, [texture]);
  useEffect(() => (cloned ? () => cloned.dispose() : undefined), [cloned]);
  return cloned;
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
