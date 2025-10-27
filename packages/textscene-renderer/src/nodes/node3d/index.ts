/**
 * Node3D registration - auto-registers Node3D parser and renderer with the node registry.
 */

import * as THREE from 'three';
import { nodeRegistry } from '../../core/NodeRegistry';
import type { NodeTypeRegistration } from '../../core/NodeRegistry';
import { parseNode3D, isNode3D } from './parser';
import { createNode3DGizmo, applyNode3DTransform } from './renderer';
import type { Node3DProperties } from './types';

const node3DRegistration: NodeTypeRegistration = {
  typeName: 'Node3D',
  typeGuard: isNode3D,
  parser: parseNode3D,
  renderer: (name: string, properties: Node3DProperties): THREE.Object3D => {
    const object3D = createNode3DGizmo(name);

    if (properties.transform) {
      applyNode3DTransform(object3D, properties);
    }

    return object3D;
  },
};

nodeRegistry.register(node3DRegistration);

export { node3DRegistration };
export * from './parser';
export * from './renderer';
export * from './types';
