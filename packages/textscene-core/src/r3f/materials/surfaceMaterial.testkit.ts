/**
 * A scene-held StandardMaterial3D reference, and the three props a test reads off the bags that
 * `useSurfaceMaterial` hands back.
 */
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { subResource } from '../../testing/subResource';
import { nodeReference, type ScopedReference } from '../../resources/reading';
import { NO_RESOURCES } from '../SceneResourcesContext';
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
  return nodeReference(`SubResource("${resource.id}")`, { internalResources: tables, externalResources });
}

/** A `res://` address as a node's material property. */
export function fileMaterial(path: string): ScopedReference {
  return nodeReference(path, NO_RESOURCES);
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
