/**
 * Builds the **Raw view** node of a `[node]` heading, which the linter and the language features
 * seat, and the origin record the seating reads beside any node.
 */

import type { NodeOrigin, RawNode } from './types.js';
import { isPropertyOverrideHeading, type ParsedHeading } from './utils.js';
import { parseHeadingIndex } from './valueParsers.js';
import { INSTANCE_PLACEHOLDER_TYPE, parseIdTrail, parseUniqueId } from '../godot/scene/packedScene.js';

/** The `index` field a heading's `index=` gives its node, or none. */
export function headingIndexField(heading: ParsedHeading): { index?: number } {
  const index = parseHeadingIndex(heading.attributes.index);
  return index === undefined ? {} : { index };
}

/**
 * A **Raw view** node, built without NodeRegistry, so without three.js. It has no typed `properties`: a helper the
 * linter and the renderer share reads `rawProperties`, which holds the same literals on either tree
 * (`parser/rawPropertyParity.test.ts`).
 */
export function createRawNode(heading: ParsedHeading, rawProperties: Record<string, string>): RawNode {
  const node: RawNode = {
    name: heading.attributes.name || '',
    // The heading's own `type=`, else the identifier it states instead. Not `index=`: that is the sibling position
    // Godot restores an override at. An override heading states no type, and every reader treats empty as unknowable.
    type:
      heading.attributes.type ||
      (heading.attributes.instance_placeholder ? INSTANCE_PLACEHOLDER_TYPE : '') ||
      heading.attributes.instance ||
      '',
    rawProperties,
    children: [], // seatScene fills it.
  };

  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  if (isPropertyOverrideHeading(heading)) {
    node.overridesExistingNode = true;
  }
  if (heading.attributes.owner) node.owner = heading.attributes.owner;
  Object.assign(node, headingIndexField(heading));

  // The instance reference goes on the dedicated `instance` field, not a `__instance` key in the property schema.
  if (heading.attributes.instance) {
    node.instance = heading.attributes.instance;
  }

  return node;
}

/** A heading's node beside the facts of the heading that `seatScene` reads. */
export function nodeOrigin<N extends RawNode>(heading: ParsedHeading, node: N, line: number): NodeOrigin<N> {
  return {
    node,
    line,
    declaredParent: heading.attributes.parent,
    idTrail: parseIdTrail(heading.attributes.parent_id_path),
    ownerIdTrail: parseIdTrail(heading.attributes.owner_uid_path),
    uniqueId: parseUniqueId(heading.attributes.unique_id),
  };
}
