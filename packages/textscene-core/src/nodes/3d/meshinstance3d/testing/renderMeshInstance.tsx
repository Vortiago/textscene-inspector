/**
 * One MeshInstance3D inside the scene providers, for a component test, and
 * the materials its draw groups end up with.
 */

import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneStack } from '../../../../r3f/testing/SceneStack';
import type { ResourceLoader } from '../../../../resources/ResourceLoader';
import { findMesh } from '../../testing/reactThreeTestInstance';
import { visibleInTree } from '../../../../r3f/visibleInTree';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { MeshInstance3DProperties } from '../types';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../../geometryinstance3d/types';
import '../index.r3f';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

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

export function meshInstanceNode(
  { mesh, materialOverride, surfaceOverrides }: MeshInstanceSpec,
  overrides: Partial<MeshInstance3DProperties> = {}
): TscnNode {
  const properties: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'Mesh',
    mesh,
    surfaceMaterialOverrides: new Map(surfaceOverrides),
    ...overrides,
  };
  if (materialOverride) properties.materialOverride = materialOverride;
  // The cull reads the raw `mesh` for the instance's geometry base (`godot/geometryBase.ts`).
  return { rawProperties: { mesh }, name: 'Mesh', type: 'MeshInstance3D', children: [], properties };
}

/** The name of the child a test mounts under the MeshInstance3D. */
export const CHILD_NAME = '__child__';

/** Whether three draws the child named {@link CHILD_NAME}: it and every ancestor are visible. */
export function childIsRendered(renderer: TestRenderer): boolean {
  const child = (renderer.scene.instance as THREE.Object3D).getObjectByName(CHILD_NAME);
  return child !== undefined && visibleInTree(child);
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
