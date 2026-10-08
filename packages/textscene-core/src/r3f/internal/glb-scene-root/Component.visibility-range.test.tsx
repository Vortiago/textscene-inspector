/**
 * Godot imports each GLB node with a mesh as a MeshInstance3D, so an override node in the
 * instancing scene gives it `visibility_range_*`, `transparency`, `cast_shadow` and a visibility
 * parent, and another node can name it as its own. Driven by one scene render from 11 units.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createGLBMesh, initGlbModules } from '../../../resources/formats/glb/glbProcessing';
import { nodesGlb } from '../../../resources/formats/glb/testing/nodesGlb';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { unfadedMaterial } from '../../materials/fadedMeshMaterials';
import { SceneStack } from '../../testing/SceneStack';
import { NodeTree } from '../../testing/NodeTree';
import { manualCameraAt, renderScene } from '../../testing/renderScene';
import { castsSunShadowFrom, drawsColour } from '../../testing/threePasses';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { GLBSceneRoot, GLB_SCENE_ROOT_TYPE } from './Component';
import { GlbInstanceProvider } from './GlbInstanceContext';
import '../../../nodes/3d/meshinstance3d/index.r3f';
import '../../../nodes/base/node3d/index.r3f';

const GLB_PATH = 'res://lamp.glb';

const RESOURCES: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: {} },
  { id: 'Green_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
];

const GLB_ROOT: TscnNode = {
  rawProperties: {},
  name: 'lamp',
  type: GLB_SCENE_ROOT_TYPE,
  children: [],
  properties: { glbPath: GLB_PATH } as Record<string, unknown>,
};

/** A box named Proxy with `proxyLines`, then Lamp, which instances the GLB, with `lines`. */
function hostScene(lines: string, proxyLines: string): { root: TscnNode; lamp: TscnNode } {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="${GLB_PATH}" id="1"]\n\n` +
      `[sub_resource type="BoxMesh" id="Box_1"]\n\n[node name="Root" type="Node3D"]\n\n` +
      `[node name="Proxy" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n${proxyLines}\n` +
      `[node name="Lamp" parent="." instance=ExtResource("1")]\n${lines}`
  );
  const root = scene.nodes[0]!;
  const lamp = root.children.find((child) => child.name === 'Lamp')!;
  const others = root.children.filter((child) => child !== lamp);
  return { root: { ...root, children: others }, lamp };
}

/** A GLB of one triangle mesh named Single. */
const SINGLE_GLB_NODES: Parameters<typeof nodesGlb>[0] = [{ name: 'Single', mesh: 0 }];

/**
 * The host and the GLB, rendered once from a camera 11 units from the triangle's centre, with
 * Lamp instancing a GLB of `glbNodes`, which hold a triangle mesh named Single.
 */
async function render(lines: string, proxyLines = '', glbNodes = SINGLE_GLB_NODES) {
  const { root, lamp } = hostScene(lines, proxyLines);
  const fake = createFakeResourceLoader();
  fake.glbMeshes.seed(GLB_PATH, await createGLBMesh(nodesGlb(glbNodes)));
  const camera = manualCameraAt({ x: 0.5, y: 0.5, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: RESOURCES }}>
      <NodeTree node={root} path="Root" />
      <GlbInstanceProvider node={lamp} path="Root/Lamp">
        <NodePathProvider path="Root/Lamp/lamp">
          <GLBSceneRoot node={GLB_ROOT} />
        </NodePathProvider>
      </GlbInstanceProvider>
    </SceneStack>,
    { camera }
  );
  await ReactThreeTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
  await renderScene(renderer, camera);
  const scene = renderer.scene.instance as THREE.Scene;
  const objectNamed = (name: string) => scene.getObjectByName(name) as THREE.Mesh;
  return { renderer, single: objectNamed('Single'), proxy: objectNamed('Proxy') };
}

beforeAll(async () => {
  await initGlbModules();
});

describe('a GLB mesh visibility range', () => {
  it('draws a GLB mesh with no override', async () => {
    const { single } = await render('');
    expect(drawsColour(single)).toBe(true);
  });

  it('draws nothing of a GLB mesh past the end its override sets', async () => {
    const { single } = await render('\n[node name="Single" parent="Lamp"]\nvisibility_range_end = 10.0\n');
    expect(drawsColour(single)).toBe(false);
  });

  it('casts no sun shadow from a GLB mesh short of its begin', async () => {
    const { single } = await render('\n[node name="Single" parent="Lamp"]\nvisibility_range_begin = 12.0\n');
    expect(castsSunShadowFrom(single)).toBe(false);
  });

  it('blends a SELF GLB mesh at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const { single } = await render(
      '\n[node name="Single" parent="Lamp"]\nvisibility_range_end = 10.0\n' +
        'visibility_range_end_margin = 2.0\nvisibility_range_fade_mode = 1\n'
    );
    expect(single.material).toMatchObject({ transparent: true, depthWrite: false, opacity: 39 / 255 });
  });

  it('fades the material a GLB mesh override puts on its surface', async () => {
    const { single } = await render(
      '\n[node name="Single" parent="Lamp"]\nsurface_material_override/0 = SubResource("Green_1")\n' +
        'visibility_range_end = 10.0\nvisibility_range_end_margin = 2.0\nvisibility_range_fade_mode = 1\n'
    );
    const drawn = single.material as THREE.MeshStandardMaterial;
    const unfaded = unfadedMaterial(drawn) as THREE.MeshStandardMaterial;
    expect([drawn.opacity, unfaded.color.getHex()]).toEqual([39 / 255, 0x00ff00]);
  });

  it('casts no shadow from a GLB mesh whose override turns cast_shadow off', async () => {
    const { single } = await render('\n[node name="Single" parent="Lamp"]\ncast_shadow = 0\n');
    expect(single.castShadow).toBe(false);
  });

  it('gives the GLB mesh its own material and shadow back on unmount (edge case)', async () => {
    const { renderer, single } = await render(
      '\n[node name="Single" parent="Lamp"]\nvisibility_range_end = 10.0\n' +
        'visibility_range_end_margin = 2.0\nvisibility_range_fade_mode = 1\ncast_shadow = 0\n'
    );
    await ReactThreeTestRenderer.act(async () => {
      await renderer.unmount();
    });
    expect([single.material, single.castShadow]).toEqual([
      expect.objectContaining({ transparent: false, opacity: 1 }),
      true,
    ]);
  });
});

/** A DEPENDENCIES range the camera, 11 units away, is inside. */
const PROXY_IN_RANGE = 'visibility_range_begin = 5.0\nvisibility_range_fade_mode = 2\n';

describe('a GLB mesh as a visibility parent or a dependant', () => {
  const proxyNamesSingle = (singleRange: string) =>
    `\n[node name="Single" parent="Lamp"]\n${singleRange}\nvisibility_range_fade_mode = 2\n\n` +
    `[node name="Detail" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box_1")\n` +
    `visibility_parent = NodePath("../Lamp/Single")\n`;

  it('hides the host node that names it while it draws inside its range', async () => {
    const { renderer } = await render(proxyNamesSingle('visibility_range_begin = 5.0'));
    const detail = (renderer.scene.instance as THREE.Scene).getObjectByName('Detail') as THREE.Mesh;
    expect(drawsColour(detail)).toBe(false);
  });

  it('shows the host node that names it once the camera is short of its begin', async () => {
    const { renderer, single } = await render(proxyNamesSingle('visibility_range_begin = 12.0'));
    const detail = (renderer.scene.instance as THREE.Scene).getObjectByName('Detail') as THREE.Mesh;
    expect([drawsColour(single), drawsColour(detail)]).toEqual([false, true]);
  });

  it('hides a GLB mesh whose override names a host parent inside its range', async () => {
    const { single } = await render(
      '\n[node name="Single" parent="Lamp"]\nvisibility_parent = NodePath("../../Proxy")\n',
      PROXY_IN_RANGE
    );
    expect(drawsColour(single)).toBe(false);
  });

  it('takes the visibility parent of the node that instances the GLB', async () => {
    const { single } = await render('visibility_parent = NodePath("../Proxy")\n', PROXY_IN_RANGE);
    expect(drawsColour(single)).toBe(false);
  });

  it('passes on no visibility parent from a GLB node whose own names itself (edge case)', async () => {
    const { single } = await render(
      'visibility_parent = NodePath("../Proxy")\n\n[node name="Group" parent="Lamp"]\nvisibility_parent = NodePath(".")\n',
      PROXY_IN_RANGE,
      [
        { name: 'Group', children: [1] },
        { name: 'Single', mesh: 0 },
      ]
    );
    expect(drawsColour(single)).toBe(true);
  });
});
