/** Marker3D renders a 3-axis cross gizmo for every node over a Node3D group (ADR-0056). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Marker3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Marker3D', Component: Marker3D });
