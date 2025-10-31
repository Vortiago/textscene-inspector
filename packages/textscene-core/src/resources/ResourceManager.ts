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
import { parsePlaneMesh } from './meshes/planemesh/parser';
import { createPlaneMeshGeometry } from './meshes/planemesh/renderer';
import { parseCapsuleMesh } from './meshes/capsulemesh/parser';
import { createCapsuleMeshGeometry } from './meshes/capsulemesh/renderer';
import { parseTorusMesh } from './meshes/torusmesh/parser';
import { createTorusMeshGeometry } from './meshes/torusmesh/renderer';
import { parsePrismMesh } from './meshes/prismmesh/parser';
import { createPrismMeshGeometry } from './meshes/prismmesh/renderer';
import { parseStandardMaterial3D } from './materials/standardmaterial3d/parser';
import { createStandardMaterial } from './materials/standardmaterial3d/renderer';
import { resolveResource, type ResourceTypeMap } from './resourceResolver';

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
  PlaneMesh: {
    parser: parsePlaneMesh,
    renderer: createPlaneMeshGeometry,
  },
  CapsuleMesh: {
    parser: parseCapsuleMesh,
    renderer: createCapsuleMeshGeometry,
  },
  TorusMesh: {
    parser: parseTorusMesh,
    renderer: createTorusMeshGeometry,
  },
  PrismMesh: {
    parser: parsePrismMesh,
    renderer: createPrismMeshGeometry,
  },
};

const materialTypeHandlers: ResourceTypeMap<THREE.Material> = {
  StandardMaterial3D: {
    parser: parseStandardMaterial3D,
    renderer: createStandardMaterial,
  },
};

export function resolveGeometry(
  meshRef: string | undefined,
  scene: TscnScene
): THREE.BufferGeometry | null {
  return resolveResource(meshRef, scene, meshTypeHandlers, 'mesh');
}

export function resolveMaterial(
  materialRef: string | undefined,
  scene: TscnScene
): THREE.Material | null {
  return resolveResource(materialRef, scene, materialTypeHandlers, 'material');
}
