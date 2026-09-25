/**
 * ShaderGlobalsOverride parser registration: reuses the Node parse. Property knowledge
 * lives in linterParser.ts. It draws nothing by design (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const shaderGlobalsOverrideRegistration: NodeTypeRegistration = {
  typeName: 'ShaderGlobalsOverride',
  parser: parseNode,
};

nodeRegistry.register(shaderGlobalsOverrideRegistration);

export { shaderGlobalsOverrideRegistration };
