/**
 * A Bone2D draws Godot's editor kite for every bone, in full colour whether or not it is selected
 * (`skeleton_2d.cpp:189-310`, ADR-0056), and hides it with the Gizmos toggle or with its own
 * `editor_settings/show_bone_gizmo`. The kite follows the bones each render.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import '../../../r3f/nodes/index';
import { OUTLINE_POINT_COUNT } from './boneKite';

function scene(upperLines = '', lowerLines = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Upper" type="Bone2D" parent="."]
position = Vector2(10, 20)
${upperLines}
[node name="Lower" type="Bone2D" parent="Upper"]
position = Vector2(100, 0)
${lowerLines}
`;
}

async function render(tscn: string, options: { selectedPath?: string | null; showGizmos?: boolean } = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(new TscnParser().parse(tscn))}
      loader={createFakeResourceLoader().loader}
      workspace="2d"
      selectedPath={options.selectedPath ?? null}
      showGizmos={options.showGizmos ?? true}
    />,
    { orthographic: true, camera: { position: [0, 0, 10] } }
  );
  await settleLoads();
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** Runs what a WebGLRenderer render runs before it draws: the matrix update and the scene's hook. */
function drawOnce(renderer: Rendered): void {
  const root = renderer.scene.instance as THREE.Scene;
  root.updateMatrixWorld();
  (root.onBeforeRender as (...args: unknown[]) => void).call(
    root,
    null,
    root,
    new THREE.OrthographicCamera(),
    null
  );
}

/** The kite meshes of the bone `name`, which the gizmo mounts inside the bone's own group. */
function kiteOf(renderer: Rendered, name: string): THREE.Mesh | undefined {
  const bone = renderer.scene.find((node) => node.instance.name === name).instance;
  return bone.children
    .flatMap((child) => child.children)
    .find((object): object is THREE.Mesh => (object as THREE.Mesh).isMesh);
}

/** Vertex `index` of a kite mesh in Godot's +Y-down pixels. */
function vertex(mesh: THREE.Mesh, index: number): [number, number] {
  const position = mesh.geometry.getAttribute('position');
  return [position.getX(index), 0 - position.getY(index)];
}

function colour(mesh: THREE.Mesh, index: number): number[] {
  const colours = mesh.geometry.getAttribute('color');
  return [colours.getX(index), colours.getY(index), colours.getZ(index), colours.getW(index)];
}

// A kite is the points of its outline and then those of its fill.
const FILL_AT = OUTLINE_POINT_COUNT;

describe('<Bone2D> gizmo', () => {
  it('draws the kite from the bone to its Bone2D child in the bone space', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    const kite = kiteOf(renderer, 'Upper')!;
    const fill = [0, 1, 2, 3].map((i) => vertex(kite, FILL_AT + i));
    const expected = [
      [0, 0],
      [20, 5],
      [100, 0],
      [20, -5],
    ];
    expected.forEach(([x, y], i) => {
      expect(fill[i]![0]).toBeCloseTo(x!, 3);
      expect(fill[i]![1]).toBeCloseTo(y!, 3);
    });
  });

  it('shades the fill white and grey, and the outline dark, at the editor colours', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    const kite = kiteOf(renderer, 'Upper')!;
    // `bone_color1`, `bone_color2` and `bone_outline_color` (`editor_settings.cpp:975,976,979`), linear.
    expect(colour(kite, FILL_AT)).toEqual([1, 1, 1, expect.closeTo(0.7, 5)]);
    expect(colour(kite, FILL_AT + 1)[0]).toBeCloseTo(0.31855, 4);
    expect(colour(kite, FILL_AT + 1)[3]).toBeCloseTo(0.7, 5);
    expect(colour(kite, 0)[0]).toBeCloseTo(0.10048, 4);
    expect(colour(kite, 0)[3]).toBeCloseTo(0.5, 5);
  });

  it('turns the outline to the selected colour when the bone itself is selected', async () => {
    const renderer = await render(scene(), { selectedPath: 'Root/Upper' });
    drawOnce(renderer);
    // `bone_selected_color` (`editor_settings.cpp:977`), linear.
    const outline = colour(kiteOf(renderer, 'Upper')!, 0);
    expect(outline[0]).toBeCloseTo(0.78741, 4);
    expect(outline[1]).toBeCloseTo(0.17064, 4);
    expect(outline[3]).toBeCloseTo(0.7, 5);
  });

  it('keeps the outline of a bone whose child is selected, as Godot tests the bone that draws', async () => {
    const renderer = await render(scene(), { selectedPath: 'Root/Upper/Lower' });
    drawOnce(renderer);
    expect(colour(kiteOf(renderer, 'Upper')!, 0)[0]).toBeCloseTo(0.10048, 4);
  });

  // `skeleton_2d.cpp:235-241`: a bone that carries the meta draws every fill point in `bone_ik_color`
  // (`editor_settings.cpp:978`). A scene saves the meta, as `metadata/` keys are stored (`object.cpp:649-661`).
  it('shades the whole fill in the IK colour for a bone that carries the pose override meta', async () => {
    const renderer = await render(scene('metadata/_local_pose_override_enabled_ = true'));
    drawOnce(renderer);
    const kite = kiteOf(renderer, 'Upper')!;
    for (const i of [0, 1, 2, 3]) {
      const fill = colour(kite, FILL_AT + i);
      expect(fill[0]).toBeCloseTo(0.78741, 4);
      expect(fill[2]).toBeCloseTo(0.17064, 4);
      expect(fill[3]).toBeCloseTo(0.7, 5);
    }
    expect(colour(kite, 0)[0]).toBeCloseTo(0.10048, 4);
  });

  it('draws the kite of a bone after the kite of its child', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    expect(kiteOf(renderer, 'Upper')!.renderOrder).toBeGreaterThan(kiteOf(renderer, 'Lower')!.renderOrder);
  });

  it('draws a bone with no child along its length and angle', async () => {
    const renderer = await render(
      scene('', 'auto_calculate_length_and_angle = false\nlength = 40.0\nbone_angle = 90.0')
    );
    drawOnce(renderer);
    const tip = vertex(kiteOf(renderer, 'Lower')!, FILL_AT + 2);
    expect(tip[0]).toBeCloseTo(0, 3);
    expect(tip[1]).toBeCloseTo(40, 3);
  });

  it('draws a calculating leaf along its own rotation, as calculate_length_and_rotation falls back', async () => {
    const renderer = await render(scene('', 'rotation = 1.5707964'));
    drawOnce(renderer);
    const tip = vertex(kiteOf(renderer, 'Lower')!, FILL_AT + 2);
    expect(tip[0]).toBeCloseTo(0, 3);
    expect(tip[1]).toBeCloseTo(16, 3);
  });

  it('follows a child bone that moves after the first draw', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    const lower = renderer.scene.find((node) => node.instance.name === 'Lower').instance;
    lower.position.set(0, -50, 0);
    drawOnce(renderer);
    const tip = vertex(kiteOf(renderer, 'Upper')!, FILL_AT + 2);
    expect(tip[0]).toBeCloseTo(0, 3);
    expect(tip[1]).toBeCloseTo(50, 3);
  });

  it('draws nothing with the Gizmos toggle off', async () => {
    const renderer = await render(scene(), { showGizmos: false });
    drawOnce(renderer);
    expect(kiteOf(renderer, 'Upper')).toBeUndefined();
  });

  it('draws nothing for a bone that sets show_bone_gizmo off, and still draws its child', async () => {
    const renderer = await render(scene('editor_settings/show_bone_gizmo = false'));
    drawOnce(renderer);
    expect(kiteOf(renderer, 'Upper')).toBeUndefined();
    expect(kiteOf(renderer, 'Lower')).toBeDefined();
  });
});
