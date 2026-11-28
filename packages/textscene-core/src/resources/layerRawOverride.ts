/**
 * Layer an override's raw properties onto the node it names, then re-parse the merged map
 * once, as components read the typed `properties`. The override fold and the instance root
 * merge both call it, so both answer alike what an override does to a node.
 */

import { canonicalisePropertyBag, resolveDeprecatedProperty } from '../godot/classdb/deprecated.js';
import {
  headingFile,
  headingLine,
  keepHeadingLine,
  mapPropertyWrites,
} from '../parser/overridePropertyWrites.js';
import type { TscnNode } from '../parser/types.js';
import type { ParsedHeading } from '../parser/utils.js';
import { nodeRegistry, type NodeTypeRegistration } from '../core/NodeRegistry.js';

type Layered = Pick<TscnNode, 'properties' | 'rawProperties' | 'rawPropertiesOrderReliable'>;

/**
 * `base`'s raw map with `overrideRaw` layered on, parsed with `base`'s type under the
 * heading of `seat`, the node whose place the result takes in the tree. Override keys win. Both
 * maps are canonicalised: an `instance=` heading has no `type=`, so the scanner leaves a pre-4.0
 * alias that would lose to the base's canonical key.
 */
export function layerRawOverride(
  seat: TscnNode,
  base: Pick<TscnNode, 'type' | 'properties' | 'rawProperties' | 'rawPropertiesOrderReliable'>,
  overrideRaw: Record<string, string>,
  phase: { beforeParenting?: boolean } = {}
): Layered {
  const written = mapPropertyWrites(overrideRaw, (key, value) =>
    resolveDeprecatedProperty(base.type, key, value)
  );
  const rawProperties = { ...canonicalisePropertyBag(base.type, base.rawProperties), ...written };
  keepHeadingLine(seat.rawProperties, rawProperties);
  const { parser } = parserRegistrationOf(base.type);
  return {
    rawProperties,
    properties: parser(headingOf(seat, base.type), rawProperties, {
      held: base.properties,
      written,
      ...phase,
      line: headingLine(overrideRaw),
      file: headingFile(overrideRaw),
    }),
    // An override that writes keys leaves neither file's order, so a file-order-sensitive
    // resolver falls back to editor save order (ADR-0035). One that writes none keeps the base's.
    rawPropertiesOrderReliable:
      Object.keys(overrideRaw).length === 0 ? base.rawPropertiesOrderReliable : false,
  };
}

/** The heading `seat` was written under, typed as `type`. */
function headingOf(seat: TscnNode, type: string): ParsedHeading {
  const { index } = seat;
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
