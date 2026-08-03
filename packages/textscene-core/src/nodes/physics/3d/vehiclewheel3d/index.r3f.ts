/**
 * VehicleWheel3D renders as a transform group with a selection-gated wheel gizmo
 * (ADR-0008 + ADR-0018). The ONLY importer of ./Component.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { VehicleWheel3D } from './Component';

nodeComponentRegistry.register({ typeName: 'VehicleWheel3D', Component: VehicleWheel3D });
