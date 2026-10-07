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
