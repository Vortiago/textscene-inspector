/** A memo over the content of what a scene resource is built from. */

import { useMemo } from 'react';
import { meshContentKey } from './meshes/meshSource';
import type { ResolvableResource } from './scopedResource';

/**
 * `build(mesh)`, built again only when the content of `mesh` and of the resources it builds from
 * changes, or null for no mesh. The key is read once per mesh object, since a packed array can run
 * to megabytes.
 */
export function useContentMemo<Built>(
  mesh: ResolvableResource | null | undefined,
  build: (mesh: ResolvableResource) => Built
): Built | null {
  const key = useMemo(() => (mesh ? meshContentKey(mesh) : null), [mesh]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `mesh`.
  return useMemo(() => (mesh ? build(mesh) : null), [key]);
}
