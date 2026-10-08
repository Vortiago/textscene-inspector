import type { TscnInternalResource } from '../parser/types';

/** Written only by `resourceContentKey`. A reparse allocates a new resource, so a key never goes stale. */
const contentKeys = new WeakMap<TscnInternalResource, string>();

/**
 * A stable key over a resource's content, for memoising what is built from it. The parser
 * allocates a fresh resource on every keystroke, so an identity key would rebuild each time. The
 * key is computed once per resource object: an inline ArrayMesh's JSON runs to megabytes.
 */
export function resourceContentKey(resource: TscnInternalResource): string {
  let key = contentKeys.get(resource);
  if (key === undefined) {
    key = `${resource.type}|${JSON.stringify(resource.data)}`;
    contentKeys.set(resource, key);
  }
  return key;
}
