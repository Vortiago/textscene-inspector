/**
 * A SubViewport with 2D content and Controls draws both into its own pass. Every CanvasItem of a
 * viewport draws into that viewport's canvas, in one tree-order draw (`viewport.cpp:5344-5345`,
 * ADR-0036), so the pass holds the Controls the container used to draw live over it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { useSelection } from '../../../r3f/contexts/SelectionContext';
import { CanvasWorldScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { compareKeys, paintKey } from '../../../r3f/testing/paintOrder';
import { drawsOf, ViewportPassStack } from './viewportPasses.testkit';

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

/** A full-rect ColorRect and a Polygon2D in a viewport wider than the largest texture. */
const WIDE_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(20000, 100)

[node name="Panel" type="ColorRect" parent="View"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
color = Color(0, 0, 0.4, 1)

[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;

describe('a SubViewport with 2D content and Controls', () => {
  // The Control painters load lazily; a loaded module lets one settled tick mount them.
  beforeAll(() => Promise.all([import('./ViewportControls'), import('./CanvasOverWorld')]));

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

  /**
   * Godot lays Controls out by `size` (`Viewport::get_visible_rect`, `viewport.cpp:1202-1210`), and
   * fails the texture allocation instead of shrinking `size` (`rendering_device.cpp:973`).
   */
  it('lays Controls out at the authored size when the target is capped', async () => {
    const portal = await portalSceneOf(WIDE_SCENE);
    const width = new THREE.Box3().setFromObject(meshOf(portal, 'Panel')).getSize(new THREE.Vector3()).x;
    expect(width).toBe(20000);
  });
});

const CANVAS_SCENE = 'View::canvas';
/** The scene a shared-world 3D pass draws: the canvas's World3D. */
const WORLD_SCENE = 'Canvas::world';

/** A viewport of `size` holding a Camera3D and a mesh, then `nodes`, under the 2D stage that shows it. */
function scene3d(size: string, nodes: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(${size})

[node name="Camera3D" type="Camera3D" parent="View"]
${nodes}`;
}

const POLYGON = `
[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;

const SCENE_3D = scene3d(
  '200, 150',
  `
[node name="Box" type="MeshInstance3D" parent="View"]

[node name="Panel" type="ColorRect" parent="View"]
offset_right = 200.0
offset_bottom = 150.0
color = Color(0, 0, 0.4, 1)
`
);

const SCENE_3D_WITH_ITEM = scene3d(
  '200, 150',
  `
[node name="Box" type="MeshInstance3D" parent="View"]
${POLYGON}`
);

/** A Camera2D at (100, 80) at zoom 2, so it frames x 50..150 of a 200x200 viewport. */
const SCENE_3D_WITH_CAMERA_2D = scene3d(
  '200, 200',
  `
[node name="Box" type="MeshInstance3D" parent="View"]

[node name="Cam" type="Camera2D" parent="View"]
position = Vector2(100, 80)
zoom = Vector2(2, 2)
${POLYGON}`
);

/** A plain Node holding a mesh and a Polygon2D, so both workspaces mount it. */
const SCENE_3D_WITH_SHARED_CONTAINER = scene3d(
  '200, 150',
  `
[node name="Group" type="Node" parent="View"]

[node name="Box" type="MeshInstance3D" parent="View/Group"]

[node name="Shape" type="Polygon2D" parent="View/Group"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`
);

/** The mesh that copies the world into the Controls' pass: the one drawn before every Control. */
function backdropOf(root: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  let found: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | undefined;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.renderOrder < 0) found = o;
  });
  if (!found) throw new Error(`expected a backdrop mesh in ${root.name}`);
  return found;
}

function SelectionProbe({ out }: { out: { current: Map<string, THREE.Object3D> | null } }) {
  out.current = useSelection().nodeObjectMap;
  return null;
}

/** The scene an object draws in: the root of its ancestors. */
function sceneOf(object: THREE.Object3D): THREE.Object3D {
  let root = object;
  while (root.parent) root = root.parent;
  return root;
}

describe('a SubViewport with 3D content and a 2D item', () => {
  beforeAll(() => import('./CanvasOverWorld'));

  it('draws the item in a pass of its own, after the world', async () => {
    const draws = await drawsOf(SCENE_3D_WITH_ITEM);
    const canvas = draws.find((d) => d.scene.name === CANVAS_SCENE);
    expect(canvas, `expected a draw of ${CANVAS_SCENE}`).toBeDefined();
    expect(meshOf(canvas!.scene, 'Shape')).toBeDefined();
    const worldIndex = draws.findIndex((d) => d.scene.name === WORLD_SCENE);
    expect(draws.indexOf(canvas!)).toBeGreaterThan(worldIndex);
  });

  it('keeps the world on the whole target under a Camera2D', async () => {
    const draws = await drawsOf(SCENE_3D_WITH_CAMERA_2D);
    const canvas = draws.find((d) => d.scene.name === CANVAS_SCENE)!;
    canvas.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(backdropOf(canvas.scene));
    // The camera frames x 50..150 and world y -130..-30, so the backdrop covers that view.
    expect([bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y]).toEqual([50, -130, 150, -30]);
  });

  it('selects a container that both workspaces mount through the world it holds', async () => {
    const parsed = new TscnParser().parse(SCENE_3D_WITH_SHARED_CONTAINER);
    const registered: { current: Map<string, THREE.Object3D> | null } = { current: null };
    const captured: { current: THREE.WebGLRenderer | null } = { current: null };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack workspace="2d" loader={createFakeResourceLoader().loader} scene={parsed}>
        <ViewportModeProvider initialShowPreviewEnvironment={false}>
          <ViewportPassStack captured={captured}>
            <SelectionProbe out={registered} />
            <CanvasWorldScope>
              <NodeDispatcher nodes={parsed.nodes} />
            </CanvasWorldScope>
          </ViewportPassStack>
        </ViewportModeProvider>
      </SceneStack>
    );
    await settleLoads();
    await withStubbedGl(captured.current!, {}, () => renderer.advanceFrames(1, 16));
    const group = [...registered.current!].find(([path]) => path.endsWith('/Group'));
    expect(sceneOf(group![1]).name).toBe(WORLD_SCENE);
  });
});

describe('a SubViewport with 3D content and Controls', () => {
  beforeAll(() => Promise.all([import('./ViewportControls'), import('./CanvasOverWorld')]));

  it('draws its Controls in a pass of their own, after the world', async () => {
    const draws = await drawsOf(SCENE_3D);
    const canvas = draws.find((d) => d.scene.name === CANVAS_SCENE);
    expect(canvas, `expected a draw of ${CANVAS_SCENE}`).toBeDefined();
    expect(meshOf(canvas!.scene, 'Panel')).toBeDefined();
  });

  it('replaces the target with the world, so a transparent world keeps its alpha', async () => {
    const draws = await drawsOf(SCENE_3D);
    const canvas = draws.find((d) => d.scene.name === CANVAS_SCENE)!;
    const backdrop = backdropOf(canvas.scene);
    expect(backdrop.material.blending).toBe(THREE.NoBlending);
  });
});
