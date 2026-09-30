/**
 * The `[ext_resource]` ids a scene's values name. The text loader waits on an `[ext_resource]`'s load only where a value
 * names it (`_parse_ext_resource`, `resource_format_text.cpp:125-151`), so only a use turns a failed dependency into a
 * failed scene.
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { extResourceIdsIn } from '../godot/index.js';

function addIdsIn(values: Iterable<unknown>, into: Set<string>): void {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const id of extResourceIdsIn(value)) into.add(id);
  }
}

function addNodeIds(node: TscnNode, into: Set<string>): void {
  if (node.instance !== undefined) addIdsIn([node.instance], into);
  addIdsIn(Object.values(node.rawProperties ?? {}), into);
  for (const child of node.children) addNodeIds(child, into);
}

/**
 * Every `[ext_resource]` id a node heading's `instance=`, a node's value or a sub-resource's value names. An orphaned node
 * counts: Godot loads it, re-parented to the root (`packed_scene.cpp:208-215`).
 */
export function usedExtResourceIds(scene: TscnScene): Set<string> {
  const ids = new Set<string>();
  for (const resource of scene.internalResources) addIdsIn(Object.values(resource.data), ids);
  for (const node of scene.nodes) addNodeIds(node, ids);
  for (const { node } of scene.orphanedNodes ?? []) addNodeIds(node, ids);
  return ids;
}
