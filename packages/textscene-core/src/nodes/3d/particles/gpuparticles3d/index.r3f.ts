/** GPUParticles3D renders as a transform-only group — reuse the Node3D component (ADR-0008). */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({ typeName: 'GPUParticles3D', Component: Node3D });
