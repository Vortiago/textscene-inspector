/**
 * Layer an override's raw properties onto the node it names, then re-parse the merged map
 * once, as components read the typed `properties`. The override fold and the instance root
 * merge both call it, so both answer alike what an override does to a node.
 */

import { canonicalisePropertyBag } from '../godot/deprecated.js';
import type { TscnNode } from '../parser/types.js';
import type { ParsedHeading } from '../parser/utils.js';
import { nodeRegistry, type NodeTypeRegistration } from '../core/NodeRegistry.js';

type Layered = Pick<TscnNode, 'properties' | 'rawProperties' | 'rawPropertiesOrderReliable'>;

/**
 * `base`'s raw map with `overrideRaw` layered on, parsed with `base`'s type under the
 * heading of `seat`, the node that wrote the override.
 */
export function layerRawOverride(
  seat: TscnNode,
  base: Pick<TscnNode, 'type' | 'rawProperties'>,
  overrideRaw: Record<string, string>
): Layered {
  const rawProperties = layerRaw(base.type, base.rawProperties, overrideRaw);
  return {
    rawProperties,
    properties: parserRegistrationOf(base.type).parser(headingOf(seat, base.type), rawProperties),
    // The layered key order is neither file's order, so a file-order-sensitive
    // resolver must fall back to editor save order (ADR-0035).
    rawPropertiesOrderReliable: false,
  };
}

/**
 * Override keys win. Both maps are canonicalised: an `instance=` heading has no `type=`,
 * so the scanner leaves a pre-4.0 alias that would lose to the base's canonical key.
 */
function layerRaw(
  type: string,
  baseRaw: Record<string, string>,
  overrideRaw: Record<string, string>
): Record<string, string> {
  return {
    ...canonicalisePropertyBag(type, baseRaw),
    ...canonicalisePropertyBag(type, overrideRaw),
  };
}

/** The heading `seat` was written under, typed as `type`. */
function headingOf(seat: TscnNode, type: string): ParsedHeading {
  const index = (seat.properties as { index?: number }).index;
  return {
    type: 'node',
    attributes: {
      type,
      name: seat.name,
      ...(seat.parent !== undefined ? { parent: seat.parent } : {}),
      ...(seat.instance ? { instance: seat.instance } : {}),
      ...(index !== undefined ? { index: String(index) } : {}),
    },
  };
}

/** A type the registry lacks parses as a Node, as `parseNodeWithRegistry` parses it. */
function parserRegistrationOf(type: string): NodeTypeRegistration {
  const registration = nodeRegistry.getRegistration(type) ?? nodeRegistry.getRegistration('Node');
  if (!registration) throw new Error(`expected a registered parser for ${type} or Node, found neither`);
  return registration;
}
