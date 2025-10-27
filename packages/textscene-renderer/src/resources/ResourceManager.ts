/**
 * ResourceManager - resolves and loads TSCN resources.
 */

import * as THREE from 'three';
import type { TscnScene } from '../parser/types';
import { parseBoxMesh } from './meshes/boxmesh/parser';
import { createBoxMeshGeometry } from './meshes/boxmesh/renderer';
import { parseCylinderMesh } from './meshes/cylindermesh/parser';
import { createCylinderMeshGeometry } from './meshes/cylindermesh/renderer';
import { parseSphereMesh } from './meshes/spheremesh/parser';
import { createSphereMeshGeometry } from './meshes/spheremesh/renderer';
import { parseStandardMaterial3D } from './materials/standardmaterial3d/parser';
import { createStandardMaterial } from './materials/standardmaterial3d/renderer';
import { resolveResource, type ResourceTypeMap } from './resourceResolver';

/**
 * Parse resource reference string to extract ID.
 * Handles: SubResource("BoxMesh_1") or ExtResource("1_abc")
 */
export function parseResourceReference(ref: string): { type: 'SubResource' | 'ExtResource'; id: string } | null {
  const subMatch = ref.match(/^SubResource\s*\(\s*"([^"]+)"\s*\)$/);
  if (subMatch && subMatch[1]) {
    return { type: 'SubResource', id: subMatch[1] };
  }

  const extMatch = ref.match(/^ExtResource\s*\(\s*"([^"]+)"\s*\)$/);
  if (extMatch && extMatch[1]) {
    return { type: 'ExtResource', id: extMatch[1] };
  }

  return null;
}

/**
 * Type handlers for mesh resources.
 */
const meshTypeHandlers: ResourceTypeMap<THREE.BufferGeometry> = {
  BoxMesh: {
    parser: parseBoxMesh,
    renderer: createBoxMeshGeometry,
  },
  CylinderMesh: {
    parser: parseCylinderMesh,
    renderer: createCylinderMeshGeometry,
  },
  SphereMesh: {
    parser: parseSphereMesh,
    renderer: createSphereMeshGeometry,
  },
};

/**
 * Type handlers for material resources.
 */
const materialTypeHandlers: ResourceTypeMap<THREE.Material> = {
  StandardMaterial3D: {
    parser: parseStandardMaterial3D,
    renderer: createStandardMaterial,
  },
};

/**
 * Resolve and create geometry from a mesh resource reference.
 * Returns null if resource cannot be resolved or loaded.
 */
export function resolveGeometry(
  meshRef: string | undefined,
  scene: TscnScene
): THREE.BufferGeometry | null {
  return resolveResource(meshRef, scene, meshTypeHandlers, 'mesh');
}

/**
 * Resolve and create material from a material resource reference.
 * Returns null if resource cannot be resolved or loaded.
 */
export function resolveMaterial(
  materialRef: string | undefined,
  scene: TscnScene
): THREE.Material | null {
  return resolveResource(materialRef, scene, materialTypeHandlers, 'material');
}
