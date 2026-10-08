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
import { manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import { CHILD_NAME, childIsRendered, meshInstanceNode } from './testing/renderMeshInstance';
import { findMesh } from '../testing/reactThreeTestInstance';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
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

const BOX_MESH = 'SubResource("Box_1")';

function node(range: Partial<VisibilityRange>, overrides: Partial<MeshInstance3DProperties> = {}): TscnNode {
  return meshInstanceNode(
    { mesh: BOX_MESH },
    { visibilityRange: { ...NO_VISIBILITY_RANGE, ...range }, ...overrides }
  );
}

async function renderFrames(mesh: TscnNode, wrap: (child: ReactNode) => ReactNode = (child) => child) {
  // On +Z, 11 units from the world origin, where the box's centre sits.
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      {wrap(
        <MeshInstance3D node={mesh}>
          <group name={CHILD_NAME} />
        </MeshInstance3D>
      )}
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  return renderer;
}

describe('<MeshInstance3D> visibility range', () => {
  it('casts a sun shadow from a mesh inside its range', async () => {
    const mesh = findMesh((await renderFrames(node({ begin: 5, end: 20 }))).scene);
    expect(castsSunShadowFrom(mesh)).toBe(true);
  });

  it('draws a mesh inside its range', async () => {
    const mesh = findMesh((await renderFrames(node({ begin: 5, end: 20 }))).scene);
    expect(drawsColour(mesh)).toBe(true);
  });

  it('draws nothing of a mesh past its end', async () => {
    const mesh = findMesh((await renderFrames(node({ end: 10 }))).scene);
    expect(drawsColour(mesh)).toBe(false);
  });

  it('casts no sun shadow from a mesh short of its begin', async () => {
    const mesh = findMesh((await renderFrames(node({ begin: 12 }))).scene);
    expect(castsSunShadowFrom(mesh)).toBe(false);
  });

  it('still casts into an omni or spot shadow when culled, as their shadow cull reads no range', async () => {
    // `_light_instance_update_shadow` filters on `instance->visible` alone (renderer_scene_cull.cpp:2415).
    const mesh = findMesh((await renderFrames(node({ begin: 12 }))).scene);
    expect(castsFrom(mesh)).toBe(true);
  });

  it('keeps the descendants of a culled mesh drawn', async () => {
    expect(childIsRendered(await renderFrames(node({ end: 10 })))).toBe(true);
  });

  it('blends a SELF mesh at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const mesh = findMesh((await renderFrames(node(selfFade))).scene);
    expect(mesh.material).toMatchObject({ transparent: true, depthWrite: false, opacity: 39 / 255 });
  });

  it('fades the render in progress, before React commits anything', async () => {
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const renderer = await renderFrames(node(selfFade));
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 7 }));
    expect(findMesh(renderer.scene).material).toMatchObject({ transparent: false, opacity: 1 });
  });

  it('fades each render by its own camera, as each Godot viewport does (edge case)', async () => {
    // 11 is inside the end margin and 5 short of it, so a SubViewport camera fades on its own.
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const renderer = await renderFrames(node(selfFade));
    const target = new THREE.WebGLRenderTarget(1, 1);
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 5 }), target);
    const nearOpacity = (findMesh(renderer.scene).material as THREE.Material).opacity;
    fireSceneRender(renderer.scene.instance, manualCameraAt({ x: 0, y: 0, z: 11 }));
    const farOpacity = (findMesh(renderer.scene).material as THREE.Material).opacity;
    expect([nearOpacity, farOpacity]).toEqual([1, 39 / 255]);
  });

  it('measures to the centre of custom_aabb, not to the origin', async () => {
    // The origin is 11 away, inside the end. The box centre at y = 5 is √146 ≈ 12.08 away.
    const offsetBox = { position: { x: -0.5, y: 4.5, z: -0.5 }, size: { x: 1, y: 1, z: 1 } };
    const mesh = findMesh((await renderFrames(node({ end: 11.5 }, { customAabb: offsetBox }))).scene);
    expect(drawsColour(mesh)).toBe(false);
  });

  it('measures in world space, through its parent transform', async () => {
    // The parent moves the box 5 back, so it is 16 from the camera, past an end of 12.
    const renderer = await renderFrames(node({ end: 12 }), (child) => (
      <group position={[0, 0, -5]}>{child}</group>
    ));
    expect(drawsColour(findMesh(renderer.scene))).toBe(false);
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
    expect(drawsColour(findMesh(renderer.scene))).toBe(false);
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

describe('<MeshInstance3D> visibility parent cycle', () => {
  it('refuses the link that comes last in tree order, not the one React mounts last (edge case)', async () => {
    // Tree order sets Proxy -> Second first, so Second -> Proxy closes the cycle. Proxy then hangs
    // off Second, which has no range, and hides with First under it. React mounts the children
    // first, which would refuse Proxy -> Second instead and show First.
    const scene = new TscnParser().parse(
      `[gd_scene format=3]\n\n[sub_resource type="BoxMesh" id="Box_1"]\n\n` +
        `[node name="Proxy" type="MeshInstance3D"]\nmesh = SubResource("Box_1")\n` +
        `visibility_range_begin = 12.0\nvisibility_parent = NodePath("Second")\n\n` +
        `[node name="First" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n` +
        `visibility_parent = NodePath("..")\n\n` +
        `[node name="Second" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n` +
        `visibility_parent = NodePath("..")\n`
    );
    const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <SceneResourcesProvider internalResources={scene.internalResources} externalResources={[]}>
          <NodeDispatcher nodes={scene.nodes} />
        </SceneResourcesProvider>
      </SelectionProvider>,
      { camera }
    );
    await renderScene(renderer, camera);
    const drawn = (name: string) => drawsColour(renderer.scene.findByProps({ name }).instance as THREE.Mesh);
    expect(['Proxy', 'First', 'Second'].map(drawn)).toEqual([false, false, true]);
  });
});
