/**
 * Generic resource resolution utility - eliminates duplication between mesh and material resolvers.
 */

import * as THREE from 'three';
import type { TscnScene, SubResource } from '../parser/types';
import { parseResourceReference } from './SubResourceResolver';
import { warn } from '../logger';
import type { ResourceLoader } from './ResourceLoader';

export interface ResourceHandler<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic handler supports any parsed property type
  parser: (data: Record<string, string>, registry?: ResourceLoader) => any | Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic handler accepts any parsed properties
  renderer: (props: any) => T | Promise<T>;
}

export type ResourceTypeMap<T> = Record<string, ResourceHandler<T>>;

/**
 * Generic resource resolver that works for any resource type.
 * Handles common logic: reference parsing, resource lookup, type checking, error handling.
 * Now async to support async parsers (e.g., texture loading in materials).
 * Supports both SubResource and ExtResource (for materials).
 */
export async function resolveResource<T>(
  resourceRef: string | undefined,
  scene: TscnScene,
  typeHandlers: ResourceTypeMap<T>,
  resourceCategory: string
): Promise<T | null> {
  if (!resourceRef) {
    return null;
  }

  const ref = parseResourceReference(resourceRef);
  if (!ref) {
    warn(`Failed to parse ${resourceCategory} reference: ${resourceRef}`);
    return null;
  }

  // Handle ExtResource for materials (requires ResourceLoader)
  if (ref.type === 'ExtResource') {
    if (resourceCategory === 'material' && scene.resourceLoader) {
      // Use event-based material loading
      const registry = scene.resourceLoader;
      const path = registry.resolvePath(ref.id);
      const cached = registry.materials.getCached(path);
      if (cached !== undefined) {
        return cached as T | null;
      }
      registry.materials.request(path);
      try {
        const material = await registry.eventBus.once<THREE.Material>('material', 'loaded', path);
        return material as T | null;
      } catch {
        return null;
      }
    } else {
      warn(`External ${resourceCategory} resources not yet supported: ${resourceRef}`);
      return null;
    }
  }

  // Handle SubResource (internal resources)
  const resource = scene.internalResources.find((r: SubResource) => {
    const resourceId = r.data.id as string | undefined;
    return resourceId === ref.id || String(r.id) === ref.id;
  });

  if (!resource) {
    warn(`SubResource not found: ${ref.id}`);
    return null;
  }

  const resourceType = resource.type;
  const handler = typeHandlers[resourceType];

  if (!handler) {
    warn(`Unsupported ${resourceCategory} type: ${resourceType}`);
    return null;
  }

  try {
    // Parser may be async (e.g., loading textures), so await it
    const props = await handler.parser(resource.data as Record<string, string>, scene.resourceLoader);

    // Renderer may be async, so await it
    return await handler.renderer(props);
  } catch (error) {
    warn(
      `Failed to create ${resourceType}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
