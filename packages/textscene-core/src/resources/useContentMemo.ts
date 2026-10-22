/** A memo over the content of what a scene resource is built from. */

import { useMemo } from 'react';

/**
 * `build(source)`, built again only when `contentKey(source)` changes, or null for no source. The key
 * is read once per source object, since a packed array can run to megabytes. A source is a resource,
 * or a resource with the tables and files whose resources the build reads.
 */
export function useContentMemo<Source, Built>(
  source: Source | null | undefined,
  contentKey: (source: Source) => string,
  build: (source: Source) => Built
): Built | null {
  const key = useMemo(() => (source ? contentKey(source) : null), [source, contentKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `source`.
  return useMemo(() => (source ? build(source) : null), [key]);
}
