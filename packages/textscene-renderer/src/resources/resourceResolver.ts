/**
 * Generic resource resolution utility - eliminates duplication between mesh and material resolvers.
 */

import type { TscnScene, TscnInternalResource } from '../parser/types';
import { parseResourceReference } from './ResourceManager';

export interface ResourceHandler<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic handler supports any parsed property type
  parser: (data: Record<string, string>) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic handler accepts any parsed properties
  renderer: (props: any) => T;
}

export type ResourceTypeMap<T> = Record<string, ResourceHandler<T>>;

/**
 * Generic resource resolver that works for any resource type.
 * Handles common logic: reference parsing, resource lookup, type checking, error handling.
 */
export function resolveResource<T>(
  resourceRef: string | undefined,
  scene: TscnScene,
  typeHandlers: ResourceTypeMap<T>,
  resourceCategory: string
): T | null {
  if (!resourceRef) {
    return null;
  }

  const ref = parseResourceReference(resourceRef);
  if (!ref) {
    console.warn(`Failed to parse ${resourceCategory} reference: ${resourceRef}`);
    return null;
  }

  if (ref.type !== 'SubResource') {
    console.warn(`External ${resourceCategory} resources not yet supported: ${resourceRef}`);
    return null;
  }

  const resource = scene.internalResources.find((r: TscnInternalResource) => {
    const resourceId = r.data.id as string | undefined;
    return resourceId === ref.id || String(r.id) === ref.id;
  });

  if (!resource) {
    console.warn(`SubResource not found: ${ref.id}`);
    return null;
  }

  const resourceType = resource.type;
  const handler = typeHandlers[resourceType];

  if (!handler) {
    console.warn(`Unsupported ${resourceCategory} type: ${resourceType}`);
    return null;
  }

  try {
    const props = handler.parser(resource.data as Record<string, string>);
    return handler.renderer(props);
  } catch (error) {
    console.warn(
      `Failed to create ${resourceType}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
