/**
 * ShapeCast3D draws its sweep gizmo for every node, in the material the node owns, which no
 * variant replaces (ADR-0056), and its children still land in the Node3D transform space.
 */
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { ShapeCast3D } from './Component';

nodeComponentRegistry.register({ typeName: 'ShapeCast3D', Component: ShapeCast3D });
