/**
 * LightmapProbe parser registration. It reuses the Node3D parse, and
 * linterParser.ts holds its properties.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const lightmapProbeRegistration: NodeTypeRegistration = {
  typeName: 'LightmapProbe',
  parser: parseNode3D,
};

nodeRegistry.register(lightmapProbeRegistration);

export { lightmapProbeRegistration };
