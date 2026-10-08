/**
 * Strict TSCN parser for linting: an adapter over TscnParserCore's scanning loop. Its observer (`strictObserver/`)
 * collects syntax and format errors as ParseError[], checks headings strictly and runs the registered property
 * validators. The lenient renderer runs the same loop with no observer.
 */

import type { RawNode } from '../parser/types.js';
import type { StrictParseResult } from './types.js';
import { placementFacts } from './placementFacts.js';
import { strictObserver } from './strictObserver/strictObserver.js';
import { TscnParserCore } from '../parser/TscnParserCore.js';
import { isPropertyOverrideHeading, type ParsedHeading } from '../parser/utils.js';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/index.js';

/**
 * A **Raw view** node, built without NodeRegistry, so without three.js. It has no typed `properties`: a helper the
 * linter and the renderer share reads `rawProperties`, which holds the same literals on either tree
 * (`parser/rawPropertyParity.test.ts`).
 */
function createRawNode(heading: ParsedHeading, rawProperties: Record<string, string>): RawNode {
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

export class StrictTscnParser {
  private core = new TscnParserCore();

  /**
   * Strictly parse TSCN content
   * @param content - TSCN file content
   * @returns Parse result with errors or parsed scene
   */
  parse(content: string): StrictParseResult {
    const { observer, errors, lines, headingReads } = strictObserver();
    const { scene, origins } = this.core.parse(content, createRawNode, observer);

    // The scene comes back even when a property failed: a bad value does not invalidate the tree. Withholding it
    // would skip the rule phase, so one out-of-range property would silence every semantic rule in the file, and a
    // rule whose condition a validator rejects would never run.
    return {
      errors,
      scene: { ...scene, ...placementFacts(origins, scene.nodes), ...headingReads },
      lines,
    };
  }
}
