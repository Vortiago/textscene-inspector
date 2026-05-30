/**
 * AudioStreamPlayer registration — parser.
 *
 * Non-spatial audio node (extends Node, not Node3D). It has no visual
 * representation, so it reuses the base Node parser; the render component
 * (index.r3f.ts) reuses the base Node component so it renders nothing visible
 * (rather than the gray GenericNodeFallback cube).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';

const audioStreamPlayerRegistration: NodeTypeRegistration = {
  typeName: 'AudioStreamPlayer',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'AudioStreamPlayer',
  parser: parseNode,
};

nodeRegistry.register(audioStreamPlayerRegistration);

export { audioStreamPlayerRegistration };
