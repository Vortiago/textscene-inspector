/**
 * Where a scene's values name each `[ext_resource]`. The text loader waits on an `[ext_resource]`'s load only where a
 * value names it, and a failed load there raises `ERR_FILE_MISSING_DEPENDENCIES` (`resource_format_text.cpp:146-154`).
 * A node body skips that error (`:288-289`). Every other read returns it, and the load fails.
 */

import { extResourceIdsIn } from '../godot/index.js';
import type { RawNode, RawScene } from '../parser/types.js';

/**
 * Where the uses of one `[ext_resource]` sit. `aborting`: a failed load of it fails the file's load. `node`: every use
 * is in a node's heading or body, which the loader leaves out and goes on.
 */
export type ExtResourceUse = 'aborting' | 'node';

/** Records each id `values` name as `use`, where no aborting use already decided it. */
function addIdsIn(values: Iterable<unknown>, use: ExtResourceUse, into: Map<string, ExtResourceUse>): void {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const id of extResourceIdsIn(value)) {
      if (into.get(id) !== 'aborting') into.set(id, use);
    }
  }
}

function addNodeIds(node: RawNode, into: Map<string, ExtResourceUse>): void {
  if (node.instance !== undefined) addIdsIn([node.instance], 'node', into);
  addIdsIn(Object.values(node.rawProperties), 'node', into);
  for (const child of node.children) addNodeIds(child, into);
}

/**
 * Each `[ext_resource]` id the scene's values name, and where. Aborting: a sub-resource's value, a `.tres` file's
 * `[resource]` value, a `[connection]` heading's `binds=`, and the `instance=` of a node heading that follows no other
 * node (`RawScene.instancesOutsideNodeBody`). A heading's fields parse through the same callback as a value
 * (`variant_parser.cpp:1861-1866`). A binds failure inside a node body leaves the rest of the heading unread, and the
 * `parse_tag` after it fails (`resource_format_text.cpp:379-384`). Node: every other node heading's `instance=` and
 * every node's value. An orphaned node counts: Godot loads it, re-parented to the root (`packed_scene.cpp:208-215`).
 */
export function extResourceUses(scene: RawScene): Map<string, ExtResourceUse> {
  const uses = new Map<string, ExtResourceUse>();
  addIdsIn(scene.connectionBinds ?? [], 'aborting', uses);
  addIdsIn(scene.instancesOutsideNodeBody ?? [], 'aborting', uses);
  for (const resource of scene.internalResources) addIdsIn(Object.values(resource.data), 'aborting', uses);
  if (scene.mainResource) addIdsIn(Object.values(scene.mainResource.data), 'aborting', uses);
  for (const node of scene.nodes) addNodeIds(node, uses);
  for (const { node } of scene.orphanedNodes ?? []) addNodeIds(node, uses);
  return uses;
}
