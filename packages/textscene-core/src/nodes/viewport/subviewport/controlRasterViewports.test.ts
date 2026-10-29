/**
 * The discovery half of the Control-raster publisher: which sub-viewports it
 * renders, where they sit in the path space, and which resource scope their
 * Controls resolve in. The rendering half is gated in the browser (ADR-0024).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TscnParser } from '../../../parser/TscnParser';
import type { TscnScene } from '../../../parser/types';
import { repoRoot } from '../../../parser/testing/parserKit';
import { collectControlRasterViewports, inheritedRtlAt } from './controlRasterViewports';
import type { CachedSceneSource } from '../../../r3f/liveSceneTree';
import '../../../r3f/nodes/index';
import { NOTHING_CACHED } from '../../../r3f/cacheSources';
import { sceneCacheOver } from '../../../r3f/liveSceneTree.testkit';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { LTR_LAYOUT_ENV } from '../../../godot/scene/control';

function parse(source: string): TscnScene {
  return new TscnParser().parse(source);
}

/** `collectControlRasterViewports` over a whole parsed scene, root scope. */
function collect(scene: TscnScene, sceneCache: CachedSceneSource = NOTHING_CACHED) {
  return collectControlRasterViewports(scene.nodes, sceneCache, {
    internalResources: scene.internalResources,
    externalResources: scene.externalResources,
  });
}

describe('collectControlRasterViewports', () => {
  it('finds a Control-only sub-viewport at its dispatcher-absolute path', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(320, 240)

[node name="Panel" type="Panel" parent="SubViewport"]
`);
    const found = collect(scene);
    expect(found).toHaveLength(1);
    // The registry key `viewportTextureRegistryKey` builds is root-prefixed, so
    // the publisher must key on the same scheme the dispatcher walks.
    expect(found[0]!.path).toBe('Root/SubViewport');
    expect(found[0]!.node.type).toBe('SubViewport');
  });

  it('leaves 3D and 2D-world sub-viewports to the WebGL publisher', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Spatial" type="SubViewport" parent="."]

[node name="Box" type="MeshInstance3D" parent="Spatial"]

[node name="World2D" type="SubViewport" parent="."]

[node name="Sprite" type="Sprite2D" parent="World2D"]

[node name="Blank" type="SubViewport" parent="."]
`);
    expect(collect(scene)).toEqual([]);
  });

  it('gives a NESTED sub-viewport its own host', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Outer" type="SubViewport" parent="."]

[node name="Panel" type="Panel" parent="Outer"]

[node name="Inner" type="SubViewport" parent="Outer/Panel"]

[node name="Label" type="Label" parent="Outer/Panel/Inner"]
`);
    // Both: Godot rasterises each viewport into its own target, and
    // `ControlDispatcher` stops at the inner boundary, so the outer host would
    // otherwise draw nothing where the inner one belongs.
    expect(collect(scene).map((v) => v.path)).toEqual(['Root/Outer', 'Root/Outer/Panel/Inner']);
  });

  it('scopes Controls inside a collapsed single-root instance to the SUB-SCENE resources', () => {
    // ADR-0013: a single-root `.tscn` instance collapses into its sub-scene
    // root, so the host's ExtResource ids never apply below it. `gui_in_3d`
    // instances `gui_panel_3d`, whose TextureRect names ExtResource("2"),
    // an id the host scene does not define.
    const sub = parse(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.webp" id="2"]

[node name="Panel3D" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]

[node name="Icon" type="TextureRect" parent="SubViewport"]
texture = ExtResource("2")
`);
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://panel_3d.tscn" id="1"]

[node name="World" type="Node3D"]

[node name="Panel" parent="." instance=ExtResource("1")]
`);
    const found = collect(host, sceneCacheOver({ 'res://panel_3d.tscn': sub }));
    expect(found).toHaveLength(1);
    expect(found[0]!.path).toBe('World/Panel/SubViewport');
    expect(found[0]!.externalResources).toBe(sub.externalResources);
    expect(found[0]!.internalResources).toBe(sub.internalResources);
  });

  it('finds only the host-authored SubViewport under an instance of a refused scene, in the host scope', () => {
    // Godot refuses to instantiate the scene, so the instance node stays as authored and none of
    // the scene's own viewports exist.
    const refused = parse(`[gd_scene format=3]

[node name="A" type="Node2D"]

[node name="Deep" type="SubViewport" parent="."]

[node name="Stray" type="Node2D"]
`);
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://refused.tscn" id="1"]

[sub_resource type="StyleBoxFlat" id="1"]
bg_color = Color(0.9, 0.9, 0.9, 1)

[node name="World" type="Node3D"]

[node name="Refused" parent="." instance=ExtResource("1")]

[node name="Own" type="SubViewport" parent="Refused"]

[node name="Panel" type="Panel" parent="Refused/Own"]
`);
    const found = collectControlRasterViewports(
      host.nodes,
      sceneCacheOver({ 'res://refused.tscn': refused }),
      {
        internalResources: host.internalResources,
        externalResources: host.externalResources,
      }
    );

    expect(found.map((v) => v.path)).toEqual(['World/Refused/Own']);
    expect(found[0]!.internalResources).toBe(host.internalResources);
    expect(found[0]!.externalResources).toBe(host.externalResources);
  });

  it('falls back to the outer scope when the sub-scene has not loaded yet', () => {
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://later.tscn" id="1"]

[node name="World" type="Node3D"]

[node name="Pending" parent="." instance=ExtResource("1")]

[node name="Own" type="SubViewport" parent="Pending"]

[node name="Panel" type="Panel" parent="Pending/Own"]
`);
    const found = collect(host, NOTHING_CACHED);
    expect(found.map((v) => v.path)).toEqual(['World/Pending/Own']);
    expect(found[0]!.externalResources).toBe(host.externalResources);
  });

  it('ends at a scene that instances itself, finding its sub-viewport once per level', () => {
    const self = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://self.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Hud" type="SubViewport" parent="."]

[node name="Panel" type="Panel" parent="Hud"]

[node name="A" parent="." instance=ExtResource("1")]

[node name="B" parent="." instance=ExtResource("1")]
`);
    const found = collect(self, sceneCacheOver({ 'res://self.tscn': self }));
    expect(found.map((v) => v.path)).toEqual(['Root/Hud', 'Root/A/Hud', 'Root/B/Hud']);
  });

  it('returns nothing for an empty tree rather than throwing', () => {
    expect(
      collectControlRasterViewports([], NOTHING_CACHED, {
        internalResources: [],
        externalResources: [],
      })
    ).toEqual([]);
  });

  it('claims the committed `gui_panel_3d` demo — the scene this path exists for', () => {
    const scene = parse(
      readFileSync(resolve(repoRoot(), 'scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn'), 'utf8')
    );
    const found = collect(scene);
    // `viewportTextureRegistryKey('GUIPanel3D/Quad', 'SubViewport')`: what the
    // quad's ViewportTexture asks the registry for.
    expect(found.map((v) => v.path)).toEqual(['GUIPanel3D/SubViewport']);
  });
});

/**
 * In a parsed subtree an `instance=` child is an untyped childless `Node`, which
 * `viewportContentKind` reads as 3D. Both owners of a registry key classify the
 * subtree `resolveViewportSubtree` returns, or a key goes unpublished and its
 * consumer stays blank.
 */
describe('collectControlRasterViewports — an instanced Control sub-scene', () => {
  const PANEL_SCENE = 'res://control_panel.tscn';

  it('claims a sub-viewport whose only child is an instance of a Control-only scene', () => {
    const scene = parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="${PANEL_SCENE}" id="1_panel"]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(320, 240)

[node name="Gui" parent="SubViewport" instance=ExtResource("1_panel")]
`);
    const panel = parse(`[gd_scene format=3]

[node name="Panel" type="Panel"]

[node name="Label" type="Label" parent="."]
text = "hi"
`);

    const found = collect(scene, sceneCacheOver({ [PANEL_SCENE]: panel }));
    expect(found.map((v) => v.path)).toEqual(['Root/SubViewport']);
  });

  it('still leaves an instanced 3D sub-scene to the WebGL publisher', () => {
    const scene = parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="${PANEL_SCENE}" id="1_panel"]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]

[node name="World" parent="SubViewport" instance=ExtResource("1_panel")]
`);
    const world = parse(`[gd_scene format=3]

[node name="World" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]
`);

    expect(collect(scene, sceneCacheOver({ [PANEL_SCENE]: world }))).toHaveLength(0);
  });

  // `Control::is_layout_rtl()` climbs through ancestors that are a `Control` or
  // a `Window` (`control.cpp:3584-3598`). A `SubViewport` is neither, so the climb
  // steps over it onto the `SubViewportContainer`, whose direction the
  // sub-viewport's Controls inherit.
  it('carries the direction of the nearest Control ABOVE the sub-viewport', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Control"]

[node name="SVC" type="SubViewportContainer" parent="."]
layout_direction = 3

[node name="SubViewport" type="SubViewport" parent="SVC"]
size = Vector2i(320, 240)

[node name="Panel" type="Panel" parent="SVC/SubViewport"]
`);
    expect(collect(scene)[0]!.inheritedRtl).toBe(true);
  });

  it('steps over every non-Control ancestor on the way, exactly as the climb does', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Control"]
layout_direction = 3

[node name="Mid" type="Node2D" parent="."]

[node name="SubViewport" type="SubViewport" parent="Mid"]

[node name="Panel" type="Panel" parent="Mid/SubViewport"]
`);
    expect(collect(scene)[0]!.inheritedRtl).toBe(true);
  });

  it('reports no inherited direction when the climb runs off the top of the tree', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]

[node name="Panel" type="Panel" parent="SubViewport"]
`);
    expect(collect(scene)[0]!.inheritedRtl).toBeNull();
  });
});

describe('inheritedRtlAt — a sub-viewport that also holds 2D content', () => {
  function rtlAt(scene: TscnScene, path: string): boolean | null {
    const tree = liveTreeOf(scene.nodes, {
      internalResources: scene.internalResources,
      externalResources: scene.externalResources,
      sceneCache: NOTHING_CACHED,
    });
    return inheritedRtlAt(tree, path, LTR_LAYOUT_ENV);
  }

  it('takes the direction of the Control around it, though the collector skips it', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Control"]

[node name="SVC" type="SubViewportContainer" parent="."]
layout_direction = 3

[node name="SubViewport" type="SubViewport" parent="SVC"]

[node name="Shape" type="Polygon2D" parent="SVC/SubViewport"]

[node name="Panel" type="Panel" parent="SVC/SubViewport"]
`);
    expect(collect(scene)).toHaveLength(0);
    expect(rtlAt(scene, 'Root/SVC/SubViewport')).toBe(true);
  });

  it('reports no direction at a root, where the climb finds no Control', () => {
    const scene = parse(`[gd_scene format=3]

[node name="SubViewport" type="SubViewport"]
`);
    expect(rtlAt(scene, 'SubViewport')).toBeNull();
  });
});
