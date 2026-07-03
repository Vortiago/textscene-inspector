/**
 * Shared `[node …]` heading resolver, used to disambiguate duplicate sibling
 * names by the Godot `parent=` value — for both "jump to node" and the
 * Outline (`DocumentSymbolProvider`) start-line lookup.
 */

import { parseHeading } from '@textscene/core/parser';

/**
 * Locate a node's `[node …]` heading line by name and Godot `parent=`.
 *
 * `expectedParent` is the raw Godot parent value (`undefined` for the root,
 * `"."` for a direct child, else the ancestor path). Matching on it
 * disambiguates duplicate sibling names. When it is absent (the unique root,
 * or a caller without a parent value), the first name match wins.
 *
 * @returns the 0-based line index, or -1 if the node is not found.
 */
export function findNodeHeadingLine(lines: string[], nodeName: string, expectedParent?: string): number {
  let firstNameMatch = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trimStart().startsWith('[node')) continue;

    const heading = parseHeading(line);
    if (heading?.type !== 'node' || heading.attributes.name !== nodeName) continue;

    if (firstNameMatch === -1) firstNameMatch = i;
    // Root's heading omits `parent`; compare it as an empty string.
    if (expectedParent === undefined || (heading.attributes.parent ?? '') === expectedParent) {
      return i;
    }
  }

  return firstNameMatch;
}
