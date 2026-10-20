/**
 * The **Raw view** node of one `[node]` heading, built without NodeRegistry, so without three.js.
 * The strict parser seats these into its tree, and the language features seat them to resolve paths.
 */

import type { RawNode } from './types.js';
import { isPropertyOverrideHeading, type ParsedHeading } from './utils.js';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/scene/packedScene.js';

/**
 * The node has no typed `properties`: a helper the linter and the renderer share reads `rawProperties`, which holds
 * the same literals on either tree (`parser/rawPropertyParity.test.ts`).
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
    children: [], // buildSceneTree fills it.
  };

  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  if (isPropertyOverrideHeading(heading)) {
    node.overridesExistingNode = true;
  }
  if (heading.attributes.owner) node.owner = heading.attributes.owner;

  // The instance reference goes on the dedicated `instance` field, not a `__instance` key in the property schema.
  if (heading.attributes.instance) {
    node.instance = heading.attributes.instance;
  }

  return node;
}
