/** A memo over a resource's content, for what is built from a scene resource. */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../parser/types';
import { resourceContentKey } from './resourceContentKey';

/**
 * `build(resource)`, built again only when the resource's content changes, or null for no
 * resource. The key is read once per resource object, since a packed array can run to megabytes.
 */
export function useContentMemo<T>(
  resource: TscnInternalResource | null | undefined,
  build: (resource: TscnInternalResource) => T
): T | null {
  const key = useMemo(() => (resource ? resourceContentKey(resource) : null), [resource]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  return useMemo(() => (resource ? build(resource) : null), [key]);
}
