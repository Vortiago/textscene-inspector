/**
 * OccluderInstance3D registration: parser.
 *
 * The Node3D parse plus the occluder reference; property knowledge lives in linterParser.ts.
 * Draws nothing by design (ADR-0008). Its component only gives the selection box the AABB of the occluder.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseOccluderInstance3D } from './parser';

const occluderInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'OccluderInstance3D',
  parser: parseOccluderInstance3D,
};

nodeRegistry.register(occluderInstance3DRegistration);
