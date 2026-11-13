/**
 * A y_sort_enabled Control in a SubViewport that also holds 2D content sorts its Control children
 * and its Node2D children in one list by y (`renderer_canvas_cull.cpp:110-160`), as it does in
 * the root canvas.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { compareKeys, paintKey } from '../../../r3f/testing/paintOrder';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';

const PORTAL_SCENE = 'View::offscreen';

/** The portal scene one frame draws, once the lazily loaded Control painters have mounted. */
async function portalSceneOf(tscn: string): Promise<THREE.Object3D> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(parsed)}
      workspace="2d"
      loader={fake.loader}
      around={(nodes) => <ViewportPassStack captured={captured}>{nodes}</ViewportPassStack>}
    />
  );
  await settleLoads();
  let portal: THREE.Object3D | undefined;
  await withStubbedGl(
    captured.current!,
    {
      onRender: (_bound, drawn) => {
        if (drawn.name === PORTAL_SCENE) portal = drawn;
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
  if (!portal) throw new Error(`expected a draw of ${PORTAL_SCENE}, got none`);
  return portal;
}

function meshOf(root: THREE.Object3D, name: string): THREE.Object3D {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (found || (o.name !== name && !o.name.endsWith(`:${name}`))) return;
    o.traverse((d) => {
      if (!found && (d as THREE.Mesh).isMesh) found = d;
    });
  });
  if (!found) throw new Error(`expected "${name}" to draw a mesh in ${root.name}, got none`);
  return found;
}

/** `Low` (y 100) and `High` (y 50) are Controls and `Sprite` (y 75) a Node2D, listed in that order. */
const SORTED_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
render_target_update_mode = 4
size = Vector2i(400, 300)

[node name="Marker" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Sorted" type="Control" parent="View"]
y_sort_enabled = true
layout_mode = 3
anchors_preset = 0

[node name="Low" type="ColorRect" parent="View/Sorted"]
offset_top = 100.0
offset_right = 100.0
offset_bottom = 200.0

[node name="High" type="ColorRect" parent="View/Sorted"]
offset_top = 50.0
offset_right = 100.0
offset_bottom = 150.0

[node name="Sprite" type="Polygon2D" parent="View/Sorted"]
position = Vector2(0, 75)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;

describe('a y-sorted Control in a SubViewport that also holds 2D content', () => {
  beforeAll(() => Promise.all([import('./ViewportControls'), import('./CanvasOverWorld')]));

  async function keys() {
    const portal = await portalSceneOf(SORTED_SCENE);
    const keyOf = (name: string) => paintKey(meshOf(portal, name));
    return { low: keyOf('Low'), high: keyOf('High'), sprite: keyOf('Sprite') };
  }

  it('draws a Control child under a Control child with a larger y', async () => {
    const { low, high } = await keys();
    expect(compareKeys(high, low)).toBeLessThan(0);
  });

  it('draws a Node2D child over the Control above it', async () => {
    const { high, sprite } = await keys();
    expect(compareKeys(high, sprite)).toBeLessThan(0);
  });

  it('draws a Node2D child under the Control below it', async () => {
    const { low, sprite } = await keys();
    expect(compareKeys(sprite, low)).toBeLessThan(0);
  });
});
