/** Path3D renders a Curve3D polyline gizmo for every node over a Node3D group (ADR-0056). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Path3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Path3D', Component: Path3D });
