/**
 * PathFollow3D registration: the parser. PathFollow3D positions its children along the parent
 * Path3D's curve and draws a handle while selected (ADR-0056).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePathFollow3D } from './parser';

const pathFollow3DRegistration: NodeTypeRegistration = {
  typeName: 'PathFollow3D',
  parser: parsePathFollow3D,
};

nodeRegistry.register(pathFollow3DRegistration);

export * from './parser';
export * from './types';
