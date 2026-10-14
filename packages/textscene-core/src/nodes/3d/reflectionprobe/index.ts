/** ReflectionProbe registration: the parser. Property knowledge for the linter lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseReflectionProbe } from './parser';

const reflectionProbeRegistration: NodeTypeRegistration = {
  typeName: 'ReflectionProbe',
  parser: parseReflectionProbe,
};

nodeRegistry.register(reflectionProbeRegistration);

export { reflectionProbeRegistration };
export * from './parser';
export * from './types';
