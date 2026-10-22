/**
 * VoxelGI registration: the parser, which reads the box for the gizmo. Property knowledge lives in
 * linterParser.ts. It is not rendered yet: index.r3f.ts registers a base component under
 * `renderIntent: 'pending'`, so the tree reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseVoxelGI } from './parser';

const voxelGIRegistration: NodeTypeRegistration = {
  typeName: 'VoxelGI',
  parser: parseVoxelGI,
};

nodeRegistry.register(voxelGIRegistration);

export * from './parser';
export * from './types';
