/** A `[sub_resource]` fixture for a test that builds a scene by hand. */

import type { TscnInternalResource } from '../parser/types';

/** An undefined value leaves its key out, as Godot omits a property at its default. */
export function subResource(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  const stored = Object.entries(data).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return { id, type, data: Object.fromEntries(stored) };
}

/** A resolver that reads a `SubResource("id")` ref against a scene's sub-resources. */
type SubResourceResolver<T> = (ref: string, internalResources: readonly TscnInternalResource[]) => T;

/** What `resolve` makes of a scene whose only sub-resource is a `type` with this `data`. */
export function resolveOnlySubResource<T>(
  type: string,
  data: Record<string, string | undefined>,
  resolve: SubResourceResolver<T>
): T {
  return resolve('SubResource("only")', [subResource(type, 'only', data)]);
}
