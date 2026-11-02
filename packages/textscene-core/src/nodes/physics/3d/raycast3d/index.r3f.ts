/**
 * RayCast3D draws its ray gizmo for every node, faint while unselected (ADR-0056), and its
 * children still land in the Node3D transform space.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { RayCast3D } from './Component';

nodeComponentRegistry.register({ typeName: 'RayCast3D', Component: RayCast3D });
