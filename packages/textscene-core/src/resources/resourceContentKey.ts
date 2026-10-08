import type { TscnInternalResource } from '../parser/types';

/**
 * A stable key over a resource's content, for memoising what is built from it. The parser
 * allocates a fresh resource on every keystroke, so an identity key would rebuild each time.
 */
export function resourceContentKey(resource: TscnInternalResource): string {
  return `${resource.type}|${JSON.stringify(resource.data)}`;
}
