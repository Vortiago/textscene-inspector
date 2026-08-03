/**
 * VehicleWheel3D registration — parser + inspector formatter.
 *
 * A wheel of a VehicleBody3D. It draws no geometry of its own — the visible
 * wheel is its child MeshInstance3D — so it renders as a transform group
 * (ADR-0005, ADR-0008) that additionally draws a selection-gated gizmo
 * (ADR-0018). Unlike the physics bodies it parses its own properties: the
 * wheel's whole configuration is geometric, and the inspector is the only place
 * it is legible.
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
