/**
 * A node's path from the scene root, the form a later heading's `parent=` names it by. Godot reads
 * `parent=` as that path and resolves it when it creates the node (`resource_format_text.cpp:205-211`).
 */

import type { DocumentSection } from './document.js';

/** The root's path, which its direct children give as their `parent=`. */
export const ROOT_PATH = '.';

/** The path of a node section, or undefined for a node with no name yet. */
export function nodePathOf(section: DocumentSection): string | undefined {
  const { name, parent } = section.attributes;
  if (!name) return undefined;
  if (parent === undefined) return ROOT_PATH;
  return parent === ROOT_PATH ? name : `${parent}/${name}`;
}
