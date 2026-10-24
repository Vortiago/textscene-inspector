import type { TscnInternalResource } from '../parser/types';
import { perObject } from '../utils/perObject';

/**
 * A stable key over a resource's content, for memoising what is built from it. The parser
 * allocates a fresh resource on every keystroke, so an identity key would rebuild each time. The
 * key is computed once per resource object: an inline ArrayMesh's JSON runs to megabytes.
 */
export const resourceContentKey = perObject(
  (resource: TscnInternalResource): string => `${resource.type}|${JSON.stringify(resource.data)}`
);
