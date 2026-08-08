/**
 * The eight `ExtResource` texture slots of a StandardMaterial3D, driven through
 * the resource pipeline.
 *
 * The hook sequence here is load-bearing and deliberately flat: one
 * `useResource` per slot, always called, in `TEXTURE_PROPERTIES` order.
 */

import type * as THREE from 'three';
import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { useResource, type ResourceResult } from '../../../resources/useResource';
import { collectTextureRequests, type TextureSlot } from './meshTextureSlots';

export interface MeshTextureSlots {
  /** Per slot, the `res://` path requested, or absent when the slot is empty. */
  requests: Partial<Record<TextureSlot, string>>;
  /** Per slot, the pipeline's result, or null when nothing was requested. */
  slots: Record<TextureSlot, ResourceResult<THREE.Texture> | null>;
}

export function useMeshTextureSlots(
  materialSubResource: TscnInternalResource | undefined,
  externalResources: readonly TscnExternalResource[]
): MeshTextureSlots {
  // Collect texture-path references off the SubResource material and
  // ask the resource loader for each one. The path is the resolved
  // `ExtResource("id").path`; if the metadata doesn't include it (rare),
  // we skip the slot.
  const textureRequests = useMemo(
    () => collectTextureRequests(materialSubResource, externalResources),
    [materialSubResource, externalResources]
  );

  // Drive `useResource` for every requested slot. Hooks must be called
  // unconditionally, in stable order — `TEXTURE_PROPERTIES` is the
  // canonical ordering so even an empty request still calls each hook
  // with an `''` path placeholder, which the hook treats as a no-op
  // (returns `pending` and emits nothing because nothing subscribes
  // to an empty path).
  const albedoStatus = useResource<THREE.Texture>(
    textureRequests.albedo_texture ?? '',
    'Texture2D'
  );
  const normalStatus = useResource<THREE.Texture>(
    textureRequests.normal_texture ?? '',
    'Texture2D'
  );
  const roughnessStatus = useResource<THREE.Texture>(
    textureRequests.roughness_texture ?? '',
    'Texture2D'
  );
  const metallicStatus = useResource<THREE.Texture>(
    textureRequests.metallic_texture ?? '',
    'Texture2D'
  );
  const emissionStatus = useResource<THREE.Texture>(
    textureRequests.emission_texture ?? '',
    'Texture2D'
  );
  // Parity-audit fix: `ao_texture` now resolves and wires
  // through to `material.aoMap`. Was silently dropped because the slot
  // wasn't in `TEXTURE_PROPERTIES` pre-fix.
  const aoStatus = useResource<THREE.Texture>(
    textureRequests.ao_texture ?? '',
    'Texture2D'
  );
  const heightmapStatus = useResource<THREE.Texture>(
    textureRequests.heightmap_texture ?? '',
    'Texture2D'
  );
  const anisotropyFlowmapStatus = useResource<THREE.Texture>(
    textureRequests.anisotropy_flowmap ?? '',
    'Texture2D'
  );

  const textureSlots = useMemo(
    () => ({
      albedo_texture: textureRequests.albedo_texture ? albedoStatus : null,
      normal_texture: textureRequests.normal_texture ? normalStatus : null,
      roughness_texture: textureRequests.roughness_texture ? roughnessStatus : null,
      metallic_texture: textureRequests.metallic_texture ? metallicStatus : null,
      emission_texture: textureRequests.emission_texture ? emissionStatus : null,
      ao_texture: textureRequests.ao_texture ? aoStatus : null,
      heightmap_texture: textureRequests.heightmap_texture ? heightmapStatus : null,
      anisotropy_flowmap: textureRequests.anisotropy_flowmap ? anisotropyFlowmapStatus : null,
    }),
    [
      textureRequests,
      albedoStatus,
      normalStatus,
      roughnessStatus,
      metallicStatus,
      emissionStatus,
      aoStatus,
      heightmapStatus,
      anisotropyFlowmapStatus,
    ]
  );

  return { requests: textureRequests, slots: textureSlots };
}
