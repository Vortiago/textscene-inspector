/**
 * A scene-held StandardMaterial3D reference, and the three props a test reads off the bags that
 * `useSurfaceMaterial` hands back.
 */
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { subResource } from '../../testing/subResource';
import type { ScopedReference } from '../../resources/reading';
import { referenceIn } from '../../resources/reading/scopedReference.testkit';
import type { SurfaceMaterial } from './useSurfaceMaterial';

/** The material body for `properties`. */
export function standardMaterialResource(properties: Record<string, string>): TscnInternalResource {
  return subResource('StandardMaterial3D', 'Material_a', properties);
}

/** `resource` as a node's material property, in the scene tables that hold it and `internalResources`. */
export function inlineSource(
  resource: TscnInternalResource,
  internalResources: readonly TscnInternalResource[] = [],
  externalResources: readonly TscnExternalResource[] = []
): ScopedReference {
  const tables = internalResources.includes(resource) ? internalResources : [resource, ...internalResources];
  return referenceIn(`SubResource("${resource.id}")`, externalResources, tables);
}

/** A scene-held StandardMaterial3D with `properties`. */
export function inlineMaterial(
  properties: Record<string, string>,
  internalResources: readonly TscnInternalResource[] = [],
  externalResources: readonly TscnExternalResource[] = []
): ScopedReference {
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
