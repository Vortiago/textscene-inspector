/**
 * VehicleWheel3D renders as a transform group with a wheel gizmo for every node
 * (ADR-0008, ADR-0056). The only importer of ./Component.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { VehicleWheel3D } from './Component';

nodeComponentRegistry.register({ typeName: 'VehicleWheel3D', Component: VehicleWheel3D });
