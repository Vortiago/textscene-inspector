/**
 * Layer a type-less override's raw properties onto the node it names, then re-parse
 * the merged map once through the target type's parser, as components read the typed
 * `properties`. `mergeInstanceRoot` shares it, so both answer alike what an override
 * does to a node.
 */

import { canonicalisePropertyBag } from '../godot/deprecated.js';
import type { TscnNode } from '../parser/types.js';
import type { ParsedHeading } from '../parser/utils.js';
import { nodeRegistry } from '../core/NodeRegistry.js';

/**
 * `existing` with `overrideRaw` layered on. Returns `existing` untouched when
 * there is nothing to layer; falls back to the raw merge alone when the target
 * type has no registered parser (a hand-built node, or an unsupported type).
 */
export function layerRawOverride(
  existing: TscnNode,
  overrideRaw: Record<string, string> | undefined
): TscnNode {
  if (!overrideRaw) return existing;

  // Canonicalised against the type the scanner did not have: an `instance=`
  // heading has no `type=`, so a pre-4.0 alias in the override is still spelled
  // as the file wrote it.
  const mergedRaw = {
    ...existing.rawProperties,
    ...canonicalisePropertyBag(existing.type, overrideRaw),
  };
  const registration = nodeRegistry.getRegistration(existing.type);
  if (!registration) return { ...existing, rawProperties: mergedRaw };

  const heading: ParsedHeading = {
    type: 'node',
    attributes: {
      type: existing.type,
      name: existing.name,
      ...(existing.parent !== undefined ? { parent: existing.parent } : {}),
    },
  };
  return {
    ...existing,
    rawProperties: mergedRaw,
    properties: registration.parser(heading, mergedRaw),
  };
}
