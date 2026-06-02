/**
 * CharacterBody3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0005, ADR-0008),
 * reusing the Node3D transform parse; the render component (index.r3f.ts)
 * reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';

const characterBody3DRegistration: NodeTypeRegistration = {
  typeName: 'CharacterBody3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'CharacterBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(characterBody3DRegistration);

export { characterBody3DRegistration };
