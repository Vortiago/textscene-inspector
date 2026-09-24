/**
 * The discovery half of the Control-raster publisher: which sub-viewports it
 * renders, where they sit in the path space, and which resource scope their
 * Controls resolve in. The rendering half is gated in the browser (ADR-0024).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TscnParser } from '../../../parser/TscnParser';
import type { TscnScene } from '../../../parser/types';
import { collectControlRasterViewports, type SceneScopeSource } from './controlRasterViewports';
import '../../../r3f/nodes/index';

function parse(source: string): TscnScene {
  return new TscnParser().parse(source);
}

/**
 * Walked up from this file, never `process.cwd()`: the suite runs from the repo
 * root under `pnpm test:unit` and from the package dir under
 * `pnpm --filter @textscene/core test`.
 */
function repoRoot(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above this test');
}

/** A scene cache answering for exactly the paths in `scenes`. */
function cache(scenes: Record<string, TscnScene>): SceneScopeSource {
  return { getCached: (path) => scenes[path] };
}

const NO_SCENES: SceneScopeSource = { getCached: () => undefined };

/** `collectControlRasterViewports` over a whole parsed scene, root scope. */
function collect(scene: TscnScene, sceneCache: SceneScopeSource = NO_SCENES) {
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
    const found = collect(host, cache({ 'res://panel_3d.tscn': sub }));
    expect(found).toHaveLength(1);
    expect(found[0]!.path).toBe('World/Panel/SubViewport');
    expect(found[0]!.externalResources).toBe(sub.externalResources);
    expect(found[0]!.internalResources).toBe(sub.internalResources);
  });

  it('keeps the OUTER scope for a host-authored child of an instance node', () => {
    // A multi-root sub-scene does not collapse: the instance node stays, its
    // authored children keep the outer scope, and the loaded roots get the
    // sub-scene's, the split `liveChildGroups` documents.
    const authored = parse(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://inner.png" id="9"]

[node name="A" type="Node2D"]

[node name="Deep" type="SubViewport" parent="."]

[node name="Label" type="Label" parent="Deep"]
`);
    // Two roots, so `mergeInstanceRoot` refuses the collapse. Built rather than
    // parsed: a `.tscn` has one root, and the multi-root shape reaches the walk
    // from the loader's cache (a GLB, a composed scene).
    const sub = {
      nodes: [{ ...authored.nodes[0]!, children: [] }, authored.nodes[0]!.children[0]!],
      internalResources: authored.internalResources,
      externalResources: authored.externalResources,
    };
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://multi.tscn" id="1"]

[node name="World" type="Node3D"]

[node name="Multi" parent="." instance=ExtResource("1")]

[node name="Own" type="SubViewport" parent="Multi"]

[node name="Panel" type="Panel" parent="Multi/Own"]
`);
    const found = collectControlRasterViewports(
      host.nodes,
      { getCached: (path) => (path === 'res://multi.tscn' ? sub : undefined) },
      { internalResources: host.internalResources, externalResources: host.externalResources }
    );
    const byPath = Object.fromEntries(found.map((v) => [v.path, v]));
    expect(Object.keys(byPath).sort()).toEqual(['World/Multi/Deep', 'World/Multi/Own']);
    expect(byPath['World/Multi/Own']!.externalResources).toBe(host.externalResources);
    expect(byPath['World/Multi/Deep']!.externalResources).toBe(sub.externalResources);
  });

  it("keeps the HOST internalResources pool for a host-authored SubViewport under a multi-root instance, not the sub-scene's", () => {
    // Pins `liveChildGroups`' optional `internalResources` argument, which no
    // other test here reads. Host and sub-scene both declare id "1" for a
    // different StyleBoxFlat, so a wrong pool shows as a wrong colour, not as
    // an absent one.
    const authored = parse(`[gd_scene format=3]

[sub_resource type="StyleBoxFlat" id="1"]
bg_color = Color(0.1, 0.2, 0.3, 1)

[node name="A" type="Node2D"]

[node name="Deep" type="SubViewport" parent="."]

[node name="Label" type="Label" parent="Deep"]
`);
    const sub = {
      nodes: [{ ...authored.nodes[0]!, children: [] }, authored.nodes[0]!.children[0]!],
      internalResources: authored.internalResources,
      externalResources: authored.externalResources,
    };
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://multi.tscn" id="1"]

[sub_resource type="StyleBoxFlat" id="1"]
bg_color = Color(0.9, 0.9, 0.9, 1)

[node name="World" type="Node3D"]

[node name="Multi" parent="." instance=ExtResource("1")]

[node name="Own" type="SubViewport" parent="Multi"]

[node name="Panel" type="Panel" parent="Multi/Own"]
`);
    const found = collectControlRasterViewports(
      host.nodes,
      { getCached: (path) => (path === 'res://multi.tscn' ? sub : undefined) },
      { internalResources: host.internalResources, externalResources: host.externalResources }
    );
    const byPath = Object.fromEntries(found.map((v) => [v.path, v]));

    const hostOwned = byPath['World/Multi/Own']!;
    expect(hostOwned.internalResources).toBe(host.internalResources);
    expect(hostOwned.internalResources[0]!.data.bg_color).toBe('Color(0.9, 0.9, 0.9, 1)');

    // The sub-scene's own SubViewport keeps resolving against its own pool.
    const subOwned = byPath['World/Multi/Deep']!;
    expect(subOwned.internalResources).toBe(sub.internalResources);
    expect(subOwned.internalResources[0]!.data.bg_color).toBe('Color(0.1, 0.2, 0.3, 1)');
  });

  it('falls back to the outer scope when the sub-scene has not loaded yet', () => {
    const host = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://later.tscn" id="1"]

[node name="World" type="Node3D"]

[node name="Pending" parent="." instance=ExtResource("1")]

[node name="Own" type="SubViewport" parent="Pending"]

[node name="Panel" type="Panel" parent="Pending/Own"]
`);
    const found = collect(host, NO_SCENES);
    expect(found.map((v) => v.path)).toEqual(['World/Pending/Own']);
    expect(found[0]!.externalResources).toBe(host.externalResources);
  });

  it('returns nothing for an empty tree rather than throwing', () => {
    expect(collectControlRasterViewports([], NO_SCENES, {
      internalResources: [],
      externalResources: [],
    })).toEqual([]);
  });

  it('claims the committed `gui_panel_3d` demo — the scene this path exists for', () => {
    const scene = parse(
      readFileSync(
        resolve(repoRoot(), 'scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn'),
        'utf8'
      )
    );
    const found = collect(scene);
    expect(found.map((v) => v.path)).toEqual(['GUIPanel3D/SubViewport']);
    // `viewportTextureRegistryKey('GUIPanel3D/Quad', 'SubViewport')`: what the
    // quad's ViewportTexture asks the registry for.
    expect(found[0]!.size).toEqual({ x: 560, y: 360 });
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

    const found = collect(scene, cache({ [PANEL_SCENE]: panel }));
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

    expect(collect(scene, cache({ [PANEL_SCENE]: world }))).toHaveLength(0);
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
