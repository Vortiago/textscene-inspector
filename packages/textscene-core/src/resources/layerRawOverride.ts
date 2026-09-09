/**
 * Layer a type-less override's raw properties onto the node it names.
 *
 * Godot writes an override as raw text with no `type=`, so the properties that
 * matter arrive in `rawProperties`. Merging only those is not enough: every
 * component reads the TYPED `properties`, so a node whose raw map says one thing
 * and whose typed properties still say the sub-scene's original renders as
 * though the override were never authored.
 *
 * So the merged raw map is re-parsed ONCE through the target type's registered
 * parser. Extracted from `mergeInstanceRoot`, which needs the same thing for a
 * collapsing instance root, so the two cannot drift into different answers for
 * "what does an override do to a node".
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
