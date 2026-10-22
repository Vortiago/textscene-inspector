/** A memo over the content of what a scene resource is built from. */

import { useMemo } from 'react';

/**
 * `build(input)`, built again only when `contentKey(input)` changes, or null for no input. The key
 * is read once per input object, since a packed array can run to megabytes. `input` is a resource,
 * or a resource with the tables whose sub-resources the build reads.
 */
export function useContentMemo<Input, Built>(
  input: Input | null | undefined,
  contentKey: (input: Input) => string,
  build: (input: Input) => Built
): Built | null {
  const key = useMemo(() => (input ? contentKey(input) : null), [input, contentKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `input`.
  return useMemo(() => (input ? build(input) : null), [key]);
}
