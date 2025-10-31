/**
 * MeshInstance3D registration - auto-registers MeshInstance3D parser and renderer with the node registry.
 */

import { createMeshInstance3D } from './renderer';
import type { TscnScene } from '../../../parser/types';
import { nodeRegistry } from '../../../core/NodeRegistry';
import * as THREE from 'three';
import { formatMeshInstance3DProperties } from './propertyFormatter';
import { applyNode3DTransform } from '../../base/node3d/renderer';
import { parseMeshInstance3D, isMeshInstance3D } from './parser';
import type { NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { MeshInstance3DProperties } from './types';

// Import linter components to trigger self-registration
import './linterParser.js';
import './linter.js';
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
  propertyFormatter: formatMeshInstance3DProperties,
};

nodeRegistry.register(meshInstance3DRegistration);

export { meshInstance3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
