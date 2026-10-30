/**
 * Under BG_CANVAS a viewport draws the canvas layers up to `background_canvas_max_layer` as the
 * background of its 3D render, and the layers above over it (`renderer_viewport.cpp:339-380`, `:650-715`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { drawsOf, type PassDraw } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

const WORLD_SCENE = 'Canvas::world';

/** A 3D viewport under BG_CANVAS: an item in the world canvas, and one in a CanvasLayer at layer 5. */
function canvasBackground(maxLayer: number): string {
  return `[gd_scene format=3]

[sub_resource type="Environment" id="Canvas"]
background_mode = 3
background_canvas_max_layer = ${maxLayer}

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(200, 150)

[node name="WorldEnvironment" type="WorldEnvironment" parent="View"]
environment = SubResource("Canvas")

[node name="Camera3D" type="Camera3D" parent="View"]

[node name="Box" type="MeshInstance3D" parent="View"]

[node name="Behind" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)

[node name="Layer" type="CanvasLayer" parent="View"]
layer = 5

[node name="Front" type="Polygon2D" parent="View/Layer"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;
}

const drawing = (draws: PassDraw[], name: string): number =>
  draws.findIndex((d) => d.scene.name !== WORLD_SCENE && d.reached.includes(name));

describe('a 3D SubViewport under the Canvas background mode', () => {
  beforeAll(() => import('./CanvasOverWorld'));

  it('draws the layers up to the max layer behind the world and the rest over it', async () => {
    const draws = await drawsOf(canvasBackground(0));
    const behind = drawing(draws, 'Behind');
    const world = draws.findIndex((d) => d.scene.name === WORLD_SCENE);
    const front = drawing(draws, 'Front');
    expect(behind, 'a draw of the world canvas').toBeGreaterThanOrEqual(0);
    expect(world, 'a draw of the world').toBeGreaterThan(behind);
    expect(front, 'a draw of the layer').toBeGreaterThan(world);
    expect(draws[behind]!.reached).not.toContain('Front');
    expect(draws[front]!.reached).not.toContain('Behind');
  });

  it('shows the world the target of the canvas it drew behind it as its background', async () => {
    const draws = await drawsOf(canvasBackground(0));
    const world = draws.find((d) => d.scene.name === WORLD_SCENE)!;
    expect((world.background as THREE.Texture).name).toBe('View::canvas::target');
  });

  it('draws a layer above the max layer over the world even when the max layer is low', async () => {
    const draws = await drawsOf(canvasBackground(-3));
    const world = draws.findIndex((d) => d.scene.name === WORLD_SCENE);
    expect(drawing(draws, 'Behind')).toBeGreaterThan(world);
  });

  it('draws every layer behind the world when the max layer is above them all', async () => {
    const draws = await drawsOf(canvasBackground(9));
    const world = draws.findIndex((d) => d.scene.name === WORLD_SCENE);
    expect(drawing(draws, 'Front')).toBeLessThan(world);
  });
});
