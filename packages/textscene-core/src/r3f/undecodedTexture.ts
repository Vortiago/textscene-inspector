/**
 * Sampling a texture WITHOUT the sRGB decode — the shared primitive behind
 * every consumer that needs one.
 *
 * `textureProcessing.ts` tags every loaded texture `SRGBColorSpace`, which is
 * right for the colour maps that are the majority. Three kinds of consumer
 * need the opposite:
 *
 * - the 2D canvas, whose hardware filter must blend UNDECODED bytes and decode
 *   after (`canvas2DTextureDecode.ts`);
 * - the vendored theme icons and sprite frames, which reach the tag directly;
 * - a 3D material's NON-COLOUR maps — normal, roughness, metallic, AO,
 *   heightmap. Godot marks exactly three samplers `source_color`
 *   (`scene/resources/material.cpp:969,1066,1137` — `texture_albedo`,
 *   `texture_emission`, `texture_detail_albedo`); every other sampler there
 *   carries `hint_default_white` / `hint_roughness_*` / `hint_normal` and is
 *   read raw. A roughness value or a normal vector is data, not light.
 *
 * The retag is always on a CLONE. `useResource` hands the same cached
 * `THREE.Texture` to every consumer of a path, so mutating `colorSpace` in
 * place would flip it for every other consumer of that same path — including
 * the one legitimately using it as an albedo.
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
 *
 * The pin matters even for props R3F's `colorMaps` list does NOT name
 * (`normalMap`, `roughnessMap`, …): the list is a dependency's internal
 * detail, and a plain assignment would silently start losing the moment it
 * grows.
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
 * An undecoded (`NoColorSpace`) view of a shared, cache-identity texture: a
 * clone retagged and pinned, memoised on the input's identity and disposed on
 * replacement/unmount.
 *
 * Returns `null` while there is nothing to show yet.
 */
export function useUndecodedTexture(
  texture: THREE.Texture | null | undefined
): THREE.Texture | null {
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
