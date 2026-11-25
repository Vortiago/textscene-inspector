import { extResourceIdsIn } from '../godot/variant/resourceRef.js';
import type { StrictScene } from '../parser/types.js';

/**
 * Where the uses of one `[ext_resource]` sit. `aborting`: a failed load of it fails the file's load. `node`: every use
 * is in a node's heading or body, which the loader leaves out and goes on.
 */
export type ExtResourceUse = 'aborting' | 'node';

/** Each `[ext_resource]` id the scene's values name, and where, from the place the core scan gives each. */
export function extResourceUses(scene: Pick<StrictScene, 'fileValues'>): Map<string, ExtResourceUse> {
  const uses = new Map<string, ExtResourceUse>();
  for (const { text, place } of scene.fileValues ?? []) {
    const use = place === 'node' ? 'node' : 'aborting';
    for (const id of extResourceIdsIn(text)) if (uses.get(id) !== 'aborting') uses.set(id, use);
  }
  return uses;
}
