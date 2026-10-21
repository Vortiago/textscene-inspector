/** LightmapGI registration: the parser. Property knowledge for the linter lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLightmapGI } from './parser';

const lightmapGIRegistration: NodeTypeRegistration = {
  typeName: 'LightmapGI',
  parser: parseLightmapGI,
};

nodeRegistry.register(lightmapGIRegistration);

export * from './parser';
export * from './types';
