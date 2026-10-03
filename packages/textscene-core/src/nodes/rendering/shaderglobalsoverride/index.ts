/**
 * ShaderGlobalsOverride parser registration: reuses the Node parse. Property knowledge
 * lives in linterParser.ts. Its Godot effect is not implemented here yet
 * (ADR-0045), so index.r3f.ts registers Node as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const shaderGlobalsOverrideRegistration: NodeTypeRegistration = {
  typeName: 'ShaderGlobalsOverride',
  parser: parseNode,
};

nodeRegistry.register(shaderGlobalsOverrideRegistration);

export { shaderGlobalsOverrideRegistration };
