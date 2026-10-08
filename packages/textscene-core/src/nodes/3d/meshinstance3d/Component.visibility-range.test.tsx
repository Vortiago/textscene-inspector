/**
 * `visibility_range_*` against the camera distance to the centre of the instance's world AABB
 * (`renderer_scene_cull.cpp:1851`). A culled mesh draws nothing, its descendants still draw, and a
 * SELF fade blends the mesh at the eased margin alpha. Driven against an explicit camera per frame.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { castsFrom, castsSunShadowFrom, drawsColour } from '../../../r3f/testing/threePasses';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import {
  NO_VISIBILITY_RANGE,
  VisibilityRangeFadeMode,
  type VisibilityRange,
} from '../../../godot/visibilityRange';

const BOX: TscnInternalResource = { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } };

/** A camera on +Z, 11 units from the world origin, where the box's centre sits. */
function cameraAt11(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 0, 11);
  camera.updateMatrixWorld(true);
  Object.assign(camera, { manual: true });
  return camera;
}

function node(range: Partial<VisibilityRange>, overrides: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const properties: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'Ranged',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    visibilityRange: { ...NO_VISIBILITY_RANGE, ...range },
    ...overrides,
  };
  return { rawProperties: {}, name: 'Ranged', type: 'MeshInstance3D', children: [], properties };
}

async function renderFrames(mesh: TscnNode, wrap: (child: ReactNode) => ReactNode = (child) => child) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      {wrap(
        <MeshInstance3D node={mesh}>
          <group name="__child__" />
        </MeshInstance3D>
      )}
    </SceneResourcesProvider>,
    { camera: cameraAt11() }
  );
  await renderer.advanceFrames(2, 16);
  // The frame callback sets state, and this act commits the render it schedules.
  await ReactThreeTestRenderer.act(async () => {});
  return renderer;
}

function meshOf(renderer: Awaited<ReturnType<typeof renderFrames>>) {
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

function childIsRendered(renderer: Awaited<ReturnType<typeof renderFrames>>) {
  const child = renderer.scene
    .findAllByType('Group')
    .map((g) => g.instance as THREE.Object3D)
    .find((g) => g.name === '__child__');
  for (let o: THREE.Object3D | null | undefined = child; o; o = o.parent) {
    if (o.visible === false) return false;
  }
  return child !== undefined;
}

describe('<MeshInstance3D> visibility range', () => {
  it('casts a sun shadow from a mesh inside its range', async () => {
    const mesh = meshOf(await renderFrames(node({ begin: 5, end: 20 })));
    expect(castsSunShadowFrom(mesh)).toBe(true);
  });

  it('draws a mesh inside its range', async () => {
    const mesh = meshOf(await renderFrames(node({ begin: 5, end: 20 })));
    expect(drawsColour(mesh)).toBe(true);
  });

  it('draws nothing of a mesh past its end', async () => {
    const mesh = meshOf(await renderFrames(node({ end: 10 })));
    expect(drawsColour(mesh)).toBe(false);
  });

  it('casts no sun shadow from a mesh short of its begin', async () => {
    const mesh = meshOf(await renderFrames(node({ begin: 12 })));
    expect(castsSunShadowFrom(mesh)).toBe(false);
  });

  it('still casts into an omni or spot shadow when culled, as their shadow cull reads no range', async () => {
    // `_light_instance_update_shadow` filters on `instance->visible` alone (renderer_scene_cull.cpp:2415).
    const mesh = meshOf(await renderFrames(node({ begin: 12 })));
    expect(castsFrom(mesh)).toBe(true);
  });

  it('keeps the descendants of a culled mesh drawn', async () => {
    expect(childIsRendered(await renderFrames(node({ end: 10 })))).toBe(true);
  });

  it('blends a SELF mesh at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const mesh = meshOf(await renderFrames(node(selfFade)));
    expect(mesh.material).toMatchObject({ transparent: true, depthWrite: false, opacity: 39 / 255 });
  });

  it('measures to the centre of custom_aabb, not to the origin', async () => {
    // The origin is 11 away, inside the end. The box centre at y = 5 is √146 ≈ 12.08 away.
    const offsetBox = { position: { x: -0.5, y: 4.5, z: -0.5 }, size: { x: 1, y: 1, z: 1 } };
    const mesh = meshOf(await renderFrames(node({ end: 11.5 }, { customAabb: offsetBox })));
    expect(drawsColour(mesh)).toBe(false);
  });

  it('measures in world space, through its parent transform', async () => {
    // The parent moves the box 5 back, so it is 16 from the camera, past an end of 12.
    const renderer = await renderFrames(node({ end: 12 }), (child) => (
      <group position={[0, 0, -5]}>{child}</group>
    ));
    expect(drawsColour(meshOf(renderer))).toBe(false);
  });
});
