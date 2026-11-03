/** ShapeCast3D parser registration. Property knowledge lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseShapeCast3D } from './parser';

const shapeCast3DRegistration: NodeTypeRegistration = {
  typeName: 'ShapeCast3D',
  parser: parseShapeCast3D,
};

nodeRegistry.register(shapeCast3DRegistration);

export * from './parser';
export * from './types';
