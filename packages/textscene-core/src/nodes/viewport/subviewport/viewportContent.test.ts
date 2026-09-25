/**
 * The classifier that decides which publisher owns a sub-viewport's target. Both
 * publishers write the same `ViewportTextureRegistry` key, so a misclassification
 * makes two publishers race.
 */
import { describe, expect, it } from 'vitest';

import { TscnParser } from '../../../parser/TscnParser';
import { resolveViewportSubtree, viewportContentKind } from './viewportContent';
import type { CachedSceneSource } from '../../../r3f/liveSceneTree';
import '../../../r3f/nodes/index';

/** The `Viewport` node of a parsed one-viewport scene. */
function viewport(body: string) {
  const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
${body}`);
  return scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
}

describe('viewportContentKind', () => {
  it('classifies Node3D content as 3d', () => {
    expect(viewportContentKind(viewport('\n[node name="Box" type="MeshInstance3D" parent="Viewport"]'))).toBe(
      '3d'
    );
  });

  it('classifies 2D-world content as 2d', () => {
    expect(viewportContentKind(viewport('\n[node name="Sprite" type="Sprite2D" parent="Viewport"]'))).toBe(
      '2d'
    );
  });

  /** Controls are drawn by the native Control-raster pass (ADR-0037), not the offscreen pass. */
  it('classifies Control-only content as dom', () => {
    expect(viewportContentKind(viewport('\n[node name="Panel" type="ColorRect" parent="Viewport"]'))).toBe(
      'dom'
    );
  });

  it('classifies an empty sub-viewport as empty', () => {
    expect(viewportContentKind(viewport(''))).toBe('empty');
  });

  /**
   * `ProgressBar` is a `Range`, so Godot calls it 2D UI, though this previewer has
   * no component for it. Read as `'empty'`, both publishers would skip it, and a
   * `ViewportTexture` naming the path would resolve null.
   */
  it('classifies a Control with no DOM component of its own as dom', () => {
    expect(
      viewportContentKind(viewport('\n[node name="Bar" type="ProgressBar" parent="Viewport"]'))
    ).toBe('dom');
  });

  /**
   * An instance node has no type until its sub-scene resolves. Godot's own
   * viewport demos instance 3D sub-scenes, so a bare one is assumed to be 3D.
   */
  it('treats a bare instanced sub-scene as 3d content', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://robot.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Robot" parent="Viewport" instance=ExtResource("1")]
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /**
   * The 3D assumption yields to decisive evidence: a CanvasItem-only override
   * (`modulate`, `z_index`, `skew`, …) or a two-component `position` names the
   * sub-scene's world. Assuming 3D picks a `Camera3D` that does not exist and
   * publishes only the clear colour.
   */
  it('an instance carrying CanvasItem-only overrides is 2d content', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
modulate = Color(1, 1.5, 2.5, 1)
z_index = 3
position = Vector2(100, 636.5)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  it('a two-component position alone is enough — Node3D would carry three', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
position = Vector2(100, 636.5)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  it('a three-component position keeps the 3d assumption', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://robot.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Robot" parent="Viewport" instance=ExtResource("1")]
position = Vector3(1, 2, 3)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /**
   * One decisive 2D sibling settles the viewport for an untouched instance
   * beside it, such as a level next to two positioned players.
   */
  it('a decisive 2D sibling outranks a bare instance’s speculative 3d claim', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://level.tscn" id="1"]
[ext_resource type="PackedScene" path="res://player.tscn" id="2"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Level" parent="Viewport" instance=ExtResource("1")]

[node name="Player" parent="Viewport" instance=ExtResource("2")]
z_index = 3
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  /** A registered 3D type is decisive, so it still wins over 2D evidence. */
  it('a registered 3D node still outranks 2D evidence', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
z_index = 3

[node name="Box" type="MeshInstance3D" parent="Viewport"]
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /** 3D beats 2D beats DOM: a mixed target showing its 3D half beats one showing nothing. */
  it('prefers 3d over 2d and dom when kinds are mixed', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Sprite" type="Sprite2D" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport"]`)
      )
    ).toBe('3d');
  });

  it('prefers 2d over dom when there is no 3D content', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Sprite" type="Sprite2D" parent="Viewport"]`)
      )
    ).toBe('2d');
  });

  /** Content nested under a plain container still counts. */
  it('descends through a plain Node container', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Holder" type="Node" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Holder"]`)
      )
    ).toBe('3d');
  });

  /**
   * `Node` is registered (`container: true`), so "is this type registered" would
   * claim 3D for every plain-Node container. A 2D sub-scene rooted at a bare `Node`
   * would land on the 3D pass and publish a clear-colour target.
   */
  it('a plain Node container holding 2D content is 2d, not 3d', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Holder" type="Node" parent="Viewport"]

[node name="Tiles" type="TileMapLayer" parent="Viewport/Holder"]`)
      )
    ).toBe('2d');
  });

  it('a plain Node container holding only Controls is dom', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Holder" type="Node" parent="Viewport"]

[node name="Title" type="Label" parent="Viewport/Holder"]`)
      )
    ).toBe('dom');
  });

  /**
   * A nested sub-viewport's subtree draws into its own target. Counting it would
   * make an outer viewport claim content it never renders.
   */
  it('does not descend into a nested sub-viewport', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Inner" type="SubViewport" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Inner"]`)
      )
    ).toBe('empty');
  });

  /** A Control wrapping 3D content still yields a WebGL source. */
  it('finds 3D content nested under a Control', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Panel"]`)
      )
    ).toBe('3d');
  });
});

/**
 * The parsed graph cannot answer for an untouched instance: it is a typeless,
 * childless `Node` whichever world its sub-scene lives in. Once the sub-scene is
 * cached, Instance root merge gives the node its real identity.
 */
describe('resolveViewportSubtree', () => {
  /** `[gd_scene]` with one instanced child, plus the sub-scene it points at. */
  function scene(subScene: string, extra = '') {
    const parsed = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Instanced" parent="Viewport" instance=ExtResource("1")]
${extra}`);
    const node = parsed.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    const loaded = new TscnParser().parse(subScene);
    const cache: CachedSceneSource = {
      getCached: (path) =>
        path === 'res://sub.tscn'
          ? { nodes: loaded.nodes, externalResources: loaded.externalResources }
          : undefined,
    };
    return { node, externalResources: parsed.externalResources, cache };
  }

  const EMPTY_CACHE: CachedSceneSource = { getCached: () => undefined };

  it('classifies an untouched instance of a 2D sub-scene as 2d once it is cached', () => {
    const { node, externalResources, cache } = scene(`[gd_scene format=3]

[node name="Parallax" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
`);
    // The parsed graph alone still guesses 3D.
    expect(viewportContentKind(node)).toBe('3d');
    expect(
      viewportContentKind(resolveViewportSubtree(node, externalResources, cache))
    ).toBe('2d');
  });

  it('classifies an untouched instance of a 3D sub-scene as 3d', () => {
    const { node, externalResources, cache } = scene(`[gd_scene format=3]

[node name="Robot" type="Node3D"]

[node name="Body" type="MeshInstance3D" parent="."]
`);
    expect(
      viewportContentKind(resolveViewportSubtree(node, externalResources, cache))
    ).toBe('3d');
  });

  it('classifies an untouched instance of a Control sub-scene as dom', () => {
    const { node, externalResources, cache } = scene(`[gd_scene format=3]

[node name="Hud" type="Control"]

[node name="Title" type="Label" parent="."]
`);
    expect(
      viewportContentKind(resolveViewportSubtree(node, externalResources, cache))
    ).toBe('dom');
  });

  it('leaves the subtree alone while the sub-scene is still loading', () => {
    const { node, externalResources } = scene('[gd_scene format=3]\n\n[node name="X" type="Node2D"]\n');
    const resolved = resolveViewportSubtree(node, externalResources, EMPTY_CACHE);
    expect(resolved.children[0]?.type).toBe('Node');
    expect(viewportContentKind(resolved)).toBe('3d');
  });

  /**
   * Each group carries the scope its children resolve their own refs against,
   * so the resolver goes through `liveChildGroups`: this inner ref exists only in
   * the sub-scene's pool.
   */
  it('resolves a sub-scene’s own nested instance against the SUB-SCENE’s resources', () => {
    const outer = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://level.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Level" parent="Viewport" instance=ExtResource("1")]
`);
    const node = outer.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    // Note the id collision: "1" means level.tscn outside and tile.tscn inside.
    const level = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tile.tscn" id="1"]

[node name="LevelRoot" type="Node"]

[node name="Tile" parent="." instance=ExtResource("1")]
`);
    const tile = new TscnParser().parse(`[gd_scene format=3]

[node name="TileRoot" type="TileMapLayer"]
`);
    const cache: CachedSceneSource = {
      getCached: (path) =>
        path === 'res://level.tscn'
          ? { nodes: level.nodes, externalResources: level.externalResources }
          : path === 'res://tile.tscn'
            ? { nodes: tile.nodes, externalResources: tile.externalResources }
            : undefined,
    };
    expect(
      viewportContentKind(resolveViewportSubtree(node, outer.externalResources, cache))
    ).toBe('2d');
  });

  it('does not descend into a nested sub-viewport', () => {
    const parsed = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Inner" type="SubViewport" parent="Viewport"]

[node name="Instanced" parent="Viewport/Inner" instance=ExtResource("1")]
`);
    const node = parsed.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    const loaded = new TscnParser().parse('[gd_scene format=3]\n\n[node name="S" type="Sprite2D"]\n');
    const cache: CachedSceneSource = {
      getCached: () => ({ nodes: loaded.nodes, externalResources: loaded.externalResources }),
    };
    const resolved = resolveViewportSubtree(node, parsed.externalResources, cache);
    // Untouched: the nested viewport's own child is still the raw instance node.
    expect(resolved.children[0]?.children[0]?.type).toBe('Node');
    expect(viewportContentKind(resolved)).toBe('empty');
  });
});

describe('an instance override spelled with an i-suffixed composite', () => {
  it('reads Vector2i as 2D, which is what Godot writes for a pixel count', () => {
    // `Vector2i` and `Rect2i` are Godot's own spelling of `frame_coords`,
    // `region_rect` and `size`. Unlisted, they match neither discriminator, and
    // the scene falls through to the 3D publisher.
    const scene = new TscnParser().parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://sprite.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Sprite" parent="Viewport" instance=ExtResource("1")]
frame_coords = Vector2i(2, 1)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  it('reads Vector3i as 3D', () => {
    const scene = new TscnParser().parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://grid.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Grid" parent="Viewport" instance=ExtResource("1")]
cell_size = Vector3i(2, 2, 2)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });
});
