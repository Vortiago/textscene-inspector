/**
 * MeshInstance3D registration - auto-registers MeshInstance3D parser and renderer with the node registry.
 */

import * as THREE from 'three';
import { nodeRegistry } from '../../core/NodeRegistry';
import type { NodeTypeRegistration } from '../../core/NodeRegistry';
import type { TscnScene } from '../../parser/types';
import { parseMeshInstance3D, isMeshInstance3D } from './parser';
import { createMeshInstance3D } from './renderer';
import { applyNode3DTransform } from '../node3d/renderer';
import type { MeshInstance3DProperties } from './types';

const meshInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'MeshInstance3D',
  typeGuard: isMeshInstance3D,
  parser: parseMeshInstance3D,
  renderer: (name: string, properties: MeshInstance3DProperties, scene?: TscnScene): THREE.Object3D => {
    const mesh = createMeshInstance3D(name, properties, scene);

    if (properties.transform) {
      applyNode3DTransform(mesh, properties);
    }

    return mesh;
  },
};

nodeRegistry.register(meshInstance3DRegistration);

export { meshInstance3DRegistration };
export * from './parser';
export * from './renderer';
export * from './types';
