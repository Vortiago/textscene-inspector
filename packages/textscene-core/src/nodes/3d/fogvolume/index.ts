/** FogVolume registration: the parser. Property knowledge for the linter lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseFogVolume } from './parser';

const fogVolumeRegistration: NodeTypeRegistration = {
  typeName: 'FogVolume',
  parser: parseFogVolume,
};

nodeRegistry.register(fogVolumeRegistration);

export * from './parser';
export * from './types';
