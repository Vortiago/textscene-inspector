/**
 * One MeshInstance3D inside the scene providers, for a component test, and
 * the materials its draw groups end up with.
 */

import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from '../Component';
import { SceneStack } from '../../../../r3f/testing/SceneStack';
import type { ResourceLoader } from '../../../../resources/ResourceLoader';
import { findMesh } from '../../testing/reactThreeTestInstance';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { MeshInstance3DProperties } from '../types';

type TestRenderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

interface MeshInstanceScene {
  loader: ResourceLoader;
  node: TscnNode;
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
}

/** The node's mesh and the two material overrides it carries. */
interface MeshInstanceSpec {
  mesh: string;
  materialOverride?: string;
  surfaceOverrides?: ReadonlyMap<number, string>;
}

export function meshInstanceNode({ mesh, materialOverride, surfaceOverrides }: MeshInstanceSpec): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'Mesh',
    mesh,
    surfaceMaterialOverrides: new Map(surfaceOverrides),
  };
  if (materialOverride) properties.materialOverride = materialOverride;
  return { name: 'Mesh', type: 'MeshInstance3D', children: [], properties };
}

/** The element tree, for a test that re-renders it with `renderer.update`. */
export function meshInstanceTree({ loader, node, internalResources, externalResources }: MeshInstanceScene) {
  return (
    <SceneStack loader={loader} scene={{ internalResources, externalResources }}>
      <MeshInstance3D node={node} />
    </SceneStack>
  );
}

export function renderMeshInstance(scene: MeshInstanceScene): Promise<TestRenderer> {
  return ReactThreeTestRenderer.create(meshInstanceTree(scene));
}

/** One material per draw group: a one-surface mesh holds a single material, not an array. */
export function surfaceMaterials(renderer: TestRenderer): THREE.MeshStandardMaterial[] {
  const material = findMesh(renderer.scene).material;
  return (Array.isArray(material) ? material : [material]) as THREE.MeshStandardMaterial[];
}
