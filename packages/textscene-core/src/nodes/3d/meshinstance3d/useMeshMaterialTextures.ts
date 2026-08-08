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
import type { TextureState } from '../../../resources/textures/applyTextureState';
import { useViewportTextureSlot } from '../../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTexturePins } from '../../../resources/useProceduralTexture';
import { repackAnisotropyFlowmap } from '../../../resources/textures/repackFlowmap';
import {
  effectiveSlot,
  materialTextureState,
  resolveProceduralTextures,
  transformedTexture,
  TEXTURE_PROPERTIES,
} from './meshTextureSlots';
import { useMeshTextureSlots } from './useMeshTextureSlots';

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

  const albedoMap = useMemo(
    () =>
      transformedTexture(
        viewportAlbedo
          ? { value: viewportAlbedo }
          : effectiveSlot(proceduralTextures.albedo_texture, textureSlots.albedo_texture),
        textureState
      ),
    [viewportAlbedo, proceduralTextures.albedo_texture, textureSlots.albedo_texture, textureState]
  );
  const normalMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.normal_texture, textureSlots.normal_texture),
        textureState
      ),
    [proceduralTextures.normal_texture, textureSlots.normal_texture, textureState]
  );
  // PARITY LIMITATION (metallic/roughness texture channel): Godot reads the
  // channel named by `metallic_texture_channel` / `roughness_texture_channel`
  // (default RED). three.js's metalnessMap/roughnessMap read fixed channels
  // (BLUE / GREEN). Faithful for grayscale or matching-channel (ORM) maps; a
  // RED-packed map with differing channels would misread. A true fix needs
  // runtime channel-swizzling.
  const roughnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.roughness_texture, textureSlots.roughness_texture),
        textureState
      ),
    [proceduralTextures.roughness_texture, textureSlots.roughness_texture, textureState]
  );
  const metalnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.metallic_texture, textureSlots.metallic_texture),
        textureState
      ),
    [proceduralTextures.metallic_texture, textureSlots.metallic_texture, textureState]
  );
  const emissiveMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.emission_texture, textureSlots.emission_texture),
        textureState
      ),
    [proceduralTextures.emission_texture, textureSlots.emission_texture, textureState]
  );
  const aoMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.ao_texture, textureSlots.ao_texture),
        textureState
      ),
    [proceduralTextures.ao_texture, textureSlots.ao_texture, textureState]
  );
  const displacementMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.heightmap_texture, textureSlots.heightmap_texture),
        textureState
      ),
    [proceduralTextures.heightmap_texture, textureSlots.heightmap_texture, textureState]
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

  const anisotropyMap = useMemo(
    () => transformedTexture({ value: repackedFlowmap }, textureState),
    [repackedFlowmap, textureState]
  );

  // The repack allocates its own pixel buffer, so it is disposed on the same
  // terms as the procedural DataTextures above. Dispose the UV-transformed
  // texture too, and not only the repack it came from: a non-identity uv1_scale
  // makes `transformedTexture` hand back a CLONE, and the clone is what the
  // material samples. three keys its GPU texture on the sampler parameters, and
  // the clone changes wrapS/wrapT, so it gets an upload of its own while the
  // original is never uploaded at all — disposing only the original frees
  // nothing. Both are ours to release; when the transform is identity they are
  // the same object and one dispose is enough.
  useEffect(() => {
    return () => {
      repackedFlowmap?.dispose();
      if (anisotropyMap !== repackedFlowmap) anisotropyMap?.dispose();
    };
  }, [repackedFlowmap, anisotropyMap]);

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
