/**
 * A StandardMaterial3D `billboard_mode` turns the whole mesh to face the camera.
 * The test camera is near identity, so each node authors a quarter-turn yaw that
 * ENABLED must replace and DISABLED must keep, as in Sprite3D's billboard test.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { Transform3D } from '../../base/node3d/types';
import type { MeshInstance3DProperties } from './types';

/** Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 3, 0, 0): a quarter-turn about Y. */
const YAWED: Transform3D = {
  basis_x: { x: 0, y: 0, z: 1 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: -1, y: 0, z: 0 },
  origin: { x: 3, y: 0, z: 0 },
};

/**
 * Identity basis, offset to the side and up, so only a working FIXED_Y billboard
 * can yaw it toward the camera. A yawed authored basis would prove nothing.
 */
const OFFSET_UPRIGHT: Transform3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 3, y: 2, z: 0 },
};

function sub(
  type: string,
  id: string,
  data: Record<string, string> = {}
): TscnInternalResource {
  return { id, type, data: { id, ...data } };
}

/** GlowSprite-shaped node: a QuadMesh with a StandardMaterial3D override. */
function meshNode(transform: Transform3D): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'GlowSprite',
    transform,
    mesh: 'SubResource("Quad")',
    surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat")']]),
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function meshAfterFrame(
  materialData: Record<string, string>,
  transform: Transform3D = YAWED
): Promise<THREE.Mesh> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider
      internalResources={[sub('QuadMesh', 'Quad'), sub('StandardMaterial3D', 'Mat', materialData)]}
    >
      <MeshInstance3D node={meshNode(transform)} />
    </SceneResourcesProvider>
  );
  await renderer.advanceFrames(2, 16);
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

describe('<MeshInstance3D> material billboard_mode', () => {
  it('keeps the authored rotation when the material sets no billboard_mode', async () => {
    // No billboard_mode → useBillboard no-ops → the quarter-turn yaw survives.
    const mesh = await meshAfterFrame({ shading_mode: '0' });
    expect(Math.abs(mesh.quaternion.y)).toBeGreaterThan(0.5);
  });

  it('faces the camera when the material sets billboard_mode = 1 (ENABLED)', async () => {
    // ENABLED replaces the model basis with the camera's (~identity here), so
    // the authored yaw is thrown away.
    const mesh = await meshAfterFrame({ shading_mode: '0', billboard_mode: '1' });
    expect(mesh.quaternion.x).toBeCloseTo(0, 6);
    expect(mesh.quaternion.y).toBeCloseTo(0, 6);
    expect(mesh.quaternion.z).toBeCloseTo(0, 6);
  });

  it('turns only around Y when the material sets billboard_mode = 2 (FIXED_Y)', async () => {
    // Authored rotation is identity, so the yaw below can only come from a
    // working FIXED_Y billboard turning the offset node toward the camera.
    const mesh = await meshAfterFrame({ shading_mode: '0', billboard_mode: '2' }, OFFSET_UPRIGHT);
    expect(mesh.rotation.x).toBeCloseTo(0, 6);
    expect(mesh.rotation.z).toBeCloseTo(0, 6);
    expect(Math.abs(mesh.rotation.y)).toBeGreaterThan(0);
  });
});
