/** RigidBody3D renders as a transform-only group, so it reuses the Node3D component (ADR-0005, ADR-0008). */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({ typeName: 'RigidBody3D', Component: Node3D, renderIntent: 'transform-only' });
