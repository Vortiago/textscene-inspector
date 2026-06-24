/** Marker3D renders a selection-gated 3-axis cross gizmo over a Node3D group (ADR-0018). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Marker3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Marker3D', Component: Marker3D });

export { Marker3D };
