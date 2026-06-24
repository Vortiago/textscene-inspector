/** Path3D renders a selection-gated Curve3D polyline gizmo over a Node3D group (ADR-0018). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Path3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Path3D', Component: Path3D });

export { Path3D };
