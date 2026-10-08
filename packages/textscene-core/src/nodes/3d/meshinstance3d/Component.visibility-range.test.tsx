/**
 * `visibility_range_*` against the camera distance to the centre of the instance's world AABB
 * (`renderer_scene_cull.cpp:1851`). A culled mesh draws nothing, its descendants still draw, and a
 * SELF fade blends the mesh at the eased margin alpha. Driven by one scene render from 11 units.
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
import { isRendered, manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import './index.r3f';
import '../../base/node3d/index.r3f';
import '../particles/gpuparticles3d/index';
import '../particles/gpuparticles3d/index.r3f';
import {
  NO_VISIBILITY_RANGE,
  VisibilityRangeFadeMode,
  type VisibilityRange,
} from '../../../godot/visibilityRange';

const BOX: TscnInternalResource = { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } };

function node(range: Partial<VisibilityRange>, overrides: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const properties: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'Ranged',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    visibilityRange: { ...NO_VISIBILITY_RANGE, ...range },
    ...overrides,
  };
  const rawProperties: Record<string, string> = properties.mesh ? { mesh: properties.mesh } : {};
  return { rawProperties, name: 'Ranged', type: 'MeshInstance3D', children: [], properties };
}

async function renderFrames(mesh: TscnNode, wrap: (child: ReactNode) => ReactNode = (child) => child) {
  // On +Z, 11 units from the world origin, where the box's centre sits.
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      {wrap(
        <MeshInstance3D node={mesh}>
          <group name="__child__" />
        </MeshInstance3D>
      )}
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
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
  return child !== undefined && isRendered(child);
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

  it('fades the render in progress, before React commits anything', async () => {
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const renderer = await renderFrames(node(selfFade));
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 7 }));
    expect(meshOf(renderer).material).toMatchObject({ transparent: false, opacity: 1 });
  });

  it('fades each render by its own camera, as each Godot viewport does (edge case)', async () => {
    // 11 is inside the end margin and 5 short of it, so a SubViewport camera fades on its own.
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const renderer = await renderFrames(node(selfFade));
    const target = new THREE.WebGLRenderTarget(1, 1);
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 5 }), target);
    const nearOpacity = (meshOf(renderer).material as THREE.Material).opacity;
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 11 }));
    const farOpacity = (meshOf(renderer).material as THREE.Material).opacity;
    expect([nearOpacity, farOpacity]).toEqual([1, 39 / 255]);
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

  it('culls the first render, before React commits anything', async () => {
    const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
        <MeshInstance3D node={node({ end: 10 })} />
      </SceneResourcesProvider>,
      { camera }
    );
    fireSceneRender(renderer.scene.instance, camera);
    expect(drawsColour(meshOf(renderer))).toBe(false);
  });
});

/** A proxy box with a DEPENDENCIES range, and a detail box that names it as its visibility parent. */
async function proxyAndDetail(proxyRange: string) {
  return parentAndDetail(
    `[node name="Proxy" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n` +
      `${proxyRange}\nvisibility_range_fade_mode = 2\n`
  );
}

/** `proxy`, a node named Proxy, and a detail box that names it as its visibility parent. */
async function parentAndDetail(proxy: string) {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[sub_resource type="BoxMesh" id="Box_1"]\n\n` +
      `[node name="Root" type="Node3D"]\n\n${proxy}\n` +
      `[node name="Detail" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n` +
      `visibility_parent = NodePath("../Proxy")\n`
  );
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources} externalResources={[]}>
      <NodeTree node={scene.nodes[0]!} path="Root" />
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  const objectNamed = (name: string) => renderer.scene.findByProps({ name }).instance as THREE.Mesh;
  return { proxy: objectNamed('Proxy'), detail: objectNamed('Detail') };
}

describe('<MeshInstance3D> visibility parent', () => {
  it('hides the dependant while its parent draws inside its range', async () => {
    const { detail } = await proxyAndDetail('visibility_range_begin = 5.0');
    expect(drawsColour(detail)).toBe(false);
  });

  it("shows the dependant once the camera is short of its parent's begin", async () => {
    const { proxy, detail } = await proxyAndDetail('visibility_range_begin = 12.0');
    expect([drawsColour(proxy), drawsColour(detail)]).toEqual([false, true]);
  });

  it("fades the dependant in across its parent's DEPENDENCIES margin", async () => {
    // (11 - (10 - 2)) / (2 × 2) = 0.75, linear, and 0.75 × 255 = 191.25 truncates to 191.
    const { proxy, detail } = await proxyAndDetail(
      'visibility_range_end = 10.0\nvisibility_range_end_margin = 2.0'
    );
    expect([drawsColour(proxy), detail.material]).toEqual([
      true,
      expect.objectContaining({ opacity: 191 / 255 }),
    ]);
  });
});

describe('<MeshInstance3D> visibility parent the previewer does not draw', () => {
  it("shows the dependant short of an undrawn emitter's begin", async () => {
    const { detail } = await parentAndDetail(
      '[node name="Proxy" type="GPUParticles3D" parent="."]\nvisibility_range_begin = 12.0\n'
    );
    expect(drawsColour(detail)).toBe(true);
  });

  it('hides the dependant while an undrawn emitter is inside its range', async () => {
    const { detail } = await parentAndDetail(
      '[node name="Proxy" type="GPUParticles3D" parent="."]\nvisibility_range_begin = 5.0\n'
    );
    expect(drawsColour(detail)).toBe(false);
  });

  it('shows the dependant of a parent whose custom box has no surface', async () => {
    const { detail } = await parentAndDetail(
      '[node name="Proxy" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n' +
        'custom_aabb = AABB(1, 1, 1, 0, 0, 0)\nvisibility_range_begin = 5.0\n'
    );
    expect(drawsColour(detail)).toBe(true);
  });

  it('shows the dependant of a parent with no mesh, which Godot links as no parent (edge case)', async () => {
    const { detail } = await parentAndDetail(
      '[node name="Proxy" type="MeshInstance3D" parent="."]\nvisibility_range_begin = 5.0\n'
    );
    expect(drawsColour(detail)).toBe(true);
  });
});
