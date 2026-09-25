/**
 * A resource-valued property as `{ type, data }`, from either form: `SubResource("id")` resolves
 * synchronously, and `ExtResource("id")` loads its `.tres` through the resource pipeline. A
 * CollisionShape's `shape` and a NavigationRegion's polygon each come in both forms.
 */

import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import type { ParsedResource } from '../parser/parsedResource';
import { resolveExtResourcePath, resolveSubResourceRef } from './SubResourceResolver';
import { useResource } from './useResource';

export function useSubOrExtResource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): TscnInternalResource | undefined {
  const inline = useMemo(
    () => resolveSubResourceRef(ref, internalResources),
    [ref, internalResources]
  );

  // Called with '' when the shape is inline or absent, to keep the hook count stable.
  const externalPath = useMemo(
    () => (inline ? null : resolveExtResourcePath(ref, externalResources)),
    [inline, ref, externalResources]
  );
  const external = useResource<ParsedResource>(externalPath ?? '', 'resource');

  return useMemo(() => {
    if (inline) return inline;
    const tres = external.value;
    if (!externalPath || !tres) return undefined;
    return { id: externalPath, type: tres.resourceType, data: tres.properties };
  }, [inline, external.value, externalPath]);
}
