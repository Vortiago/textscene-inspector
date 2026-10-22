/**
 * An inline StandardMaterial3D source, and the three props a test reads off the bags that
 * `useSurfaceMaterial` hands back.
 */
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import type { MaterialSource } from './materialSource';
import type { SurfaceMaterial } from './useSurfaceMaterial';

/** The material body for `properties`. Keep one across renders: the source is keyed on its identity. */
export function standardMaterialResource(properties: Record<string, string>): TscnInternalResource {
  return { id: 'Material_a', type: 'StandardMaterial3D', data: properties };
}

/** `resource` as a scene-held material whose references resolve in the given tables. */
export function inlineSource(
  resource: TscnInternalResource,
  internalResources: readonly TscnInternalResource[] = [],
  externalResources: readonly TscnExternalResource[] = []
): MaterialSource {
  return { kind: 'inline', material: { resource, internalResources, externalResources } };
}

/** A scene-held StandardMaterial3D with `properties`. */
export function inlineMaterial(
  properties: Record<string, string>,
  internalResources: readonly TscnInternalResource[] = [],
  externalResources: readonly TscnExternalResource[] = []
): MaterialSource {
  return inlineSource(standardMaterialResource(properties), internalResources, externalResources);
}

/**
 * The props of the unfaded bag, typed as the physical class carries them, which holds every
 * slot. Throws for a surface that drew the missing-texture placeholder instead.
 */
export function unfadedProps(material: SurfaceMaterial): THREE.MeshPhysicalMaterialParameters {
  if (!material.bags) throw new Error('expected a surface with bags, got a missing texture');
  return material.bags.unfaded.props as THREE.MeshPhysicalMaterialParameters;
}
