/**
 * Every texture a MeshInstance3D's primary StandardMaterial3D samples, resolved
 * to the THREE.Textures the material slot binds.
 *
 * Three sources feed the same eight slots and they have a fixed precedence: a
 * `SubResource(ViewportTexture)` (live registry, albedo only) over an inline
 * procedural sub-resource (rasterised synchronously) over an `ExtResource`
 * image (fetched through the resource pipeline). What each slot ends up
 * carrying is then put through the material's own UV/sampler state.
 *
 * The `ExtResource` fan-out itself is `useMeshTextureSlots.ts`, called first so
 * its hooks keep their place at the head of the sequence.
 */

import type * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { StandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/types';
import {
  isMaterialOwnedTexture,
  type TextureState,
} from '../../../resources/textures/applyTextureState';
import { useViewportTextureSlot } from '../../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTexturePins } from '../../../resources/useProceduralTexture';
import { repackAnisotropyFlowmap } from '../../../resources/textures/repackFlowmap';
import {
  materialTextureState,
  resolveProceduralTextures,
  transformedTexture,
  TEXTURE_PROPERTIES,
} from './meshTextureSlots';
import { useMeshTextureSlots } from './useMeshTextureSlots';

/**
 * The texture this slot's material samples, and its lifetime.
 *
 * A material whose UV transform, filter or wrapping diverges from the shared
 * source samples a CLONE, and three keys its GPU upload on exactly the sampler
 * parameters the clone changes — so the clone gets an upload of its own that
 * disposing the original would never free. Without this every re-parse (one per
 * keystroke in the source pane) left another uploaded clone behind.
 *
 * `isMaterialOwnedTexture` is the tag the cloner leaves and the only thing that
 * separates ours from the loader cache's: disposing a shared source here would
 * pull it out from under every other material sampling the same path.
 */
function useTransformedTexture(
  texture: THREE.Texture | undefined,
  state: TextureState | null
): THREE.Texture | undefined {
  const transformed = useMemo(() => transformedTexture(texture, state), [texture, state]);
  useEffect(() => {
    if (!transformed || !isMaterialOwnedTexture(transformed)) return undefined;
    return () => transformed.dispose();
  }, [transformed]);
  return transformed;
}

export interface MeshMaterialTextures {
  albedoMap: THREE.Texture | undefined;
  normalMap: THREE.Texture | undefined;
  roughnessMap: THREE.Texture | undefined;
  metalnessMap: THREE.Texture | undefined;
  emissiveMap: THREE.Texture | undefined;
  aoMap: THREE.Texture | undefined;
  displacementMap: THREE.Texture | undefined;
  anisotropyMap: THREE.Texture | undefined;
  /** The first requested path that came back `unavailable`, or null. */
  firstMissingPath: string | null;
}

export function useMeshMaterialTextures(
  materialSubResource: TscnInternalResource | undefined,
  materialScalars: StandardMaterial3DScalars | null,
  meshResource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MeshMaterialTextures {
  const { requests: textureRequests, slots: textureSlots } = useMeshTextureSlots(
    materialSubResource,
    externalResources
  );

  // Procedural texture slots resolve synchronously from the scene's internal
  // resources — a `SubResource(GradientTexture2D)` is fully described in the
  // scene, so it is rasterised here rather than fetched through `useResource`
  // like an ExtResource image. This is what gives the platformer coin its
  // additive gradient glow. Any slot NOT carrying a procedural sub-resource
  // stays undefined and falls back to the async `textureSlots` above.
  //
  // Not disposed here: a procedural texture is shared by every node pointing at
  // the same sub-resource and owned by the procedural cache, which frees it on
  // eviction. Freeing it per consumer would pull it out from under the others.
  // Pinned instead, so that eviction cannot free it while THIS node is still
  // sampling it — borrowing only works if the owner knows the borrow exists.
  const { textures: proceduralTextures, keys: proceduralKeys } = useMemo(
    () => resolveProceduralTextures(materialSubResource, internalResources),
    [materialSubResource, internalResources]
  );
  useProceduralTexturePins(proceduralKeys);

  const textureState = useMemo(
    (): TextureState | null => materialTextureState(materialScalars, meshResource),
    [materialScalars, meshResource]
  );

  // A `SubResource(ViewportTexture)` albedo names a `<SubViewport>` rather than
  // a file, so it resolves through the live registry instead of the loader —
  // and it arrives AFTER first paint, once that sub-viewport has published.
  // Highest precedence of the three: nothing else can be in the slot when the
  // authored value is a ViewportTexture.
  const viewportAlbedo = useViewportTextureSlot(
    (materialSubResource?.data as { albedo_texture?: string } | undefined)?.albedo_texture,
    internalResources
  );

  // One `??` chain per slot, in the precedence at the top of this file: a
  // synchronously-resolved procedural texture stands ahead of the async slot
  // for the same map. The TEXTURE is the dependency, never its wrapper — both
  // the slot object and `proceduralTextures` are re-created on every re-parse,
  // and a fresh clone per keystroke is the whole cost being avoided.
  const albedoMap = useTransformedTexture(
    viewportAlbedo ?? proceduralTextures.albedo_texture ?? textureSlots.albedo_texture?.value,
    textureState
  );
  const normalMap = useTransformedTexture(
    proceduralTextures.normal_texture ?? textureSlots.normal_texture?.value,
    textureState
  );
  // PARITY LIMITATION (metallic/roughness texture channel): Godot reads the
  // channel named by `metallic_texture_channel` / `roughness_texture_channel`
  // (default RED). three.js's metalnessMap/roughnessMap read fixed channels
  // (BLUE / GREEN). Faithful for grayscale or matching-channel (ORM) maps; a
  // RED-packed map with differing channels would misread. A true fix needs
  // runtime channel-swizzling.
  const roughnessMap = useTransformedTexture(
    proceduralTextures.roughness_texture ?? textureSlots.roughness_texture?.value,
    textureState
  );
  const metalnessMap = useTransformedTexture(
    proceduralTextures.metallic_texture ?? textureSlots.metallic_texture?.value,
    textureState
  );
  const emissiveMap = useTransformedTexture(
    proceduralTextures.emission_texture ?? textureSlots.emission_texture?.value,
    textureState
  );
  const aoMap = useTransformedTexture(
    proceduralTextures.ao_texture ?? textureSlots.ao_texture?.value,
    textureState
  );
  const displacementMap = useTransformedTexture(
    proceduralTextures.heightmap_texture ?? textureSlots.heightmap_texture?.value,
    textureState
  );
  // Depend on the two values the repack actually reads, not on their wrappers:
  // `materialScalars` and the slot object are re-created on every re-parse and
  // every re-emit of the same cached texture, and a repack is now a canvas
  // readback plus a full-buffer copy plus a GPU re-upload.
  const anisotropyStrength = materialScalars?.anisotropy ?? 0;
  const anisotropyFlowmap = textureSlots.anisotropy_flowmap?.value;
  const repackedFlowmap = useMemo(() => {
    // Only an anisotropy-enabled material renders as MeshPhysicalMaterial and
    // samples anisotropyMap; skip the repack and the slotKey churn when the
    // strength is 0 — the map would never be read on the standard-material
    // fallback.
    if (anisotropyStrength <= 0 || !anisotropyFlowmap) return undefined;
    return repackAnisotropyFlowmap(anisotropyFlowmap);
  }, [anisotropyStrength, anisotropyFlowmap]);

  const anisotropyMap = useTransformedTexture(repackedFlowmap, textureState);

  // The repack allocates its own pixel buffer rather than going through the
  // cloner, so it carries no ownership tag and is freed here outright; the
  // UV-transformed clone the material actually samples is freed by
  // `useTransformedTexture`. At an identity transform the two are the same
  // object, untagged, and this one dispose is the whole of it.
  useEffect(() => () => repackedFlowmap?.dispose(), [repackedFlowmap]);

  // If any requested slot resolved to `unavailable`, surface the FIRST
  // such path as the placeholder label. Listing more than one would
  // bury the user under text.
  const firstMissingPath = useMemo(() => {
    for (const slot of TEXTURE_PROPERTIES) {
      const result = textureSlots[slot];
      const requested = textureRequests[slot];
      if (result && result.status === 'unavailable' && requested) {
        return requested;
      }
    }
    return null;
  }, [textureSlots, textureRequests]);

  return {
    albedoMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    emissiveMap,
    aoMap,
    displacementMap,
    anisotropyMap,
    firstMissingPath,
  };
}
