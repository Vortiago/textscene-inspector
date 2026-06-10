import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionShape3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../../r3f/contexts/ViewportModeContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { CollisionShape3DProperties } from './types';

const boxShape: TscnInternalResource = {
  id: 'BoxShape3D_1',
  type: 'BoxShape3D',
  data: { size: 'Vector3(2, 4, 0.3)' },
};

function makeNode(): TscnNode {
  const properties: CollisionShape3DProperties = {
    name: 'Col',
    shape: 'SubResource("BoxShape3D_1")',
  };
  return { name: 'Col', type: 'CollisionShape3D', children: [], properties };
}

async function render(showCollisions: boolean) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowCollisions={showCollisions}>
      <SceneResourcesProvider internalResources={[boxShape]}>
        <CollisionShape3D node={makeNode()} />
      </SceneResourcesProvider>
    </ViewportModeProvider>
  );
}

describe('<CollisionShape3D> gizmo', () => {
  it('renders NO geometry when showCollisions is off (default)', async () => {
    const renderer = await render(false);
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(0);
  });

  it('renders a wireframe box gizmo when showCollisions is on', async () => {
    const renderer = await render(true);
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.BoxGeometry & {
      parameters: { width: number; height: number; depth: number };
    };
    expect(geom.parameters.width).toBe(2);
    expect(geom.parameters.height).toBe(4);
    expect(geom.parameters.depth).toBe(0.3);
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });
});
