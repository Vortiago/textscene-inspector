/**
 * VehicleWheel3D parser and inspector formatter. The visible wheel is its child
 * MeshInstance3D, so it renders as a transform group (ADR-0005, ADR-0008) with a
 * selection-gated gizmo (ADR-0018). It parses its own properties: they are all
 * geometric, and the inspector is the only place they are legible.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVehicleWheel3D } from './parser';
import { formatVehicleWheel3DProperties } from './propertyFormatter';

const vehicleWheel3DRegistration: NodeTypeRegistration = {
  typeName: 'VehicleWheel3D',
  parser: parseVehicleWheel3D,
  propertyFormatter: formatVehicleWheel3DProperties,
};

nodeRegistry.register(vehicleWheel3DRegistration);

export { vehicleWheel3DRegistration };
export * from './parser';
export * from './types';
