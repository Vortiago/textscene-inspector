/**
 * GPUParticles3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 * The previewer does not simulate or draw particles.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';

const gpuParticles3DRegistration: NodeTypeRegistration = {
  typeName: 'GPUParticles3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'GPUParticles3D',
  parser: parseNode3D,
};

nodeRegistry.register(gpuParticles3DRegistration);

export { gpuParticles3DRegistration };
