/**
 * A SubViewport with 2D content and Controls draws both into its own pass. Every CanvasItem of a
 * viewport draws into that viewport's canvas, in one tree-order draw (`viewport.cpp:5344-5345`,
 * ADR-0036), so the pass holds the Controls the container used to draw live over it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { compareKeys, paintKey } from '../../../r3f/testing/paintOrder';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

const PORTAL_SCENE = 'View::offscreen';

/** A viewport holding a full-rect ColorRect and a Polygon2D in the authored order given. */
function scene(order: 'control-first' | 'world-first'): string {
  const control = `[node name="Panel" type="ColorRect" parent="View"]
offset_right = 200.0
offset_bottom = 150.0
color = Color(0, 0, 0.4, 1)
`;
  const world = `[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(200, 150)

${order === 'control-first' ? control + '\n' + world : world + '\n' + control}`;
}

/** The portal scene one frame draws, once the lazily loaded Control painters have mounted. */
async function portalSceneOf(tscn: string): Promise<THREE.Object3D> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ViewportPassStack captured={captured}>
        <NodeDispatcher nodes={parsed.nodes} />
      </ViewportPassStack>
    </SceneStack>
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

describe('a SubViewport with 2D content and Controls', () => {
  // The Control painters load lazily; a loaded module lets one settled tick mount them.
  beforeAll(() => import('./ViewportControls'));

  it('draws a Control into its own pass', async () => {
    const portal = await portalSceneOf(scene('control-first'));
    expect(meshOf(portal, 'Panel')).toBeDefined();
  });

  it('draws a Control under a Polygon2D authored after it', async () => {
    const portal = await portalSceneOf(scene('control-first'));
    expect(compareKeys(paintKey(meshOf(portal, 'Panel')), paintKey(meshOf(portal, 'Shape')))).toBeLessThan(0);
  });

  it('draws a Control over a Polygon2D authored before it', async () => {
    const portal = await portalSceneOf(scene('world-first'));
    expect(compareKeys(paintKey(meshOf(portal, 'Panel')), paintKey(meshOf(portal, 'Shape')))).toBeGreaterThan(
      0
    );
  });
});
