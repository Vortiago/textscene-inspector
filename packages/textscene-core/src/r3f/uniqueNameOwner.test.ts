/**
 * Which owner's `%Name` table a rendered node resolves against, and what that
 * table holds once instanced content is composed in.
 *
 * `_acquire_unique_name_in_owner` registers on the node's OWNER
 * (node.cpp:2222-2234); `get_node` reads the caller's own table, else its
 * owner's (node.cpp:1930-1938). `packed_scene.cpp:565-570` acquires a
 * sub-scene's names while THAT scene instantiates, before the outer file's
 * override properties land (:492), so the sub-scene's claimants come first.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import type { TscnScene } from '../parser/types.js';
import type { LiveTreeContext } from './liveSceneTree.js';
import { claimOwnerOf, ownerClaims } from './uniqueNameOwner.js';

const main = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]
[ext_resource type="PackedScene" path="res://inner.tscn" id="2"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Hit" parent="HudInstance/Panel"]
unique_name_in_owner = true

[node name="Extra" type="Node2D" parent="HudInstance"]
unique_name_in_owner = true

[node name="Inner" parent="HudInstance" instance=ExtResource("2")]

[node name="Gear" parent="HudInstance/Inner"]
unique_name_in_owner = true

[node name="Screen" type="Sprite2D" parent="."]
`);

const hud = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Hud" type="Node2D"]
unique_name_in_owner = true

[node name="Panel" type="Node2D" parent="."]
unique_name_in_owner = true

[node name="Hit" type="Node2D" parent="Panel"]

[node name="Widget" parent="." instance=ExtResource("1")]

[node name="Knob" parent="Widget"]
unique_name_in_owner = true

[node name="Sprite" type="Sprite2D" parent="."]
`);

const widget = new TscnParser().parse(`[gd_scene format=3]

[node name="Widget" type="Node2D"]

[node name="Knob" type="Node2D" parent="."]

[node name="Face" type="Sprite2D" parent="."]
`);

const inner = new TscnParser().parse(`[gd_scene format=3]

[node name="Inner" type="Node2D"]

[node name="Gear" type="Node2D" parent="."]

[node name="Face" type="Sprite2D" parent="."]
`);

const scenes = new Map<string, TscnScene>([
  ['res://hud.tscn', hud],
  ['res://widget.tscn', widget],
  ['res://inner.tscn', inner],
]);
const ctx: LiveTreeContext = {
  externalResources: main.externalResources,
  sceneCache: { getCached: (p) => scenes.get(p) },
};

const ownerOf = (path: string) => claimOwnerOf(path, main.nodes, ctx);

describe('claimOwnerOf', () => {
  it('owns an outer node by the outer root', () => {
    const owner = ownerOf('Root/Screen');
    expect(owner.parent).toBeUndefined();
    expect(owner.roots).toBe(main.nodes);
  });

  it('owns a node inside an instance by the instance it collapsed into', () => {
    const owner = ownerOf('Root/HudInstance/Sprite');
    expect(owner.path).toBe('Root/HudInstance');
    expect(owner.roots).toBe(hud.nodes);
    expect(owner.parent?.roots).toBe(main.nodes);
  });

  it('owns the instance node itself by the file its heading is in', () => {
    expect(ownerOf('Root/HudInstance').parent).toBeUndefined();
  });

  it('owns a node ADDED under the instance by the outer root (resource_format_text.cpp:264-265)', () => {
    expect(ownerOf('Root/HudInstance/Extra').parent).toBeUndefined();
  });

  it('owns an OVERRIDE under the instance by the sub-scene root (resource_format_text.cpp:264-265)', () => {
    expect(ownerOf('Root/HudInstance/Panel/Hit').path).toBe('Root/HudInstance');
  });

  it('nests: a node inside an instance inside an instance', () => {
    const owner = ownerOf('Root/HudInstance/Widget/Face');
    expect(owner.path).toBe('Root/HudInstance/Widget');
    expect(owner.roots).toBe(widget.nodes);
    expect(owner.parent?.path).toBe('Root/HudInstance');
  });

  it('falls back to the outer root while the sub-scene has not loaded', () => {
    const unloaded: LiveTreeContext = { ...ctx, sceneCache: { getCached: () => undefined } };
    expect(claimOwnerOf('Root/HudInstance/Sprite', main.nodes, unloaded).parent).toBeUndefined();
  });
});

describe('ownerClaims', () => {
  it('is the shared outer table for the outer root', () => {
    const table = ownerClaims(ownerOf('Root/Screen'));
    expect(table.get('%Extra')?.livePath).toBe('Root/HudInstance/Extra');
    expect(table.has('%Panel')).toBe(false);
    expect(ownerClaims(ownerOf('Root/Screen'))).toBe(table);
  });

  it('spells a sub-scene claim at its composed live path', () => {
    const table = ownerClaims(ownerOf('Root/HudInstance/Sprite'));
    expect(table.get('%Panel')?.livePath).toBe('Root/HudInstance/Panel');
  });

  it('never claims the sub-scene root itself (packed_scene.cpp:565 acquires only for owner >= 0)', () => {
    expect(ownerClaims(ownerOf('Root/HudInstance/Sprite')).has('%Hud')).toBe(false);
  });

  it('folds in the outer file override that the sub-scene root owns', () => {
    const table = ownerClaims(ownerOf('Root/HudInstance/Sprite'));
    expect(table.get('%Hit')?.livePath).toBe('Root/HudInstance/Panel/Hit');
  });

  it('leaves the outer root claim of an added node out of the sub-scene table', () => {
    expect(ownerClaims(ownerOf('Root/HudInstance/Sprite')).has('%Extra')).toBe(false);
  });

  it('folds a nested override in from the file that instanced the inner scene', () => {
    const table = ownerClaims(ownerOf('Root/HudInstance/Widget/Face'));
    expect(table.get('%Knob')?.livePath).toBe('Root/HudInstance/Widget/Knob');
    expect(table.has('%Panel')).toBe(false);
  });

  it('files an override under the instance the outer file ADDED inside another, not the outer instance', () => {
    const owner = ownerOf('Root/HudInstance/Inner/Face');
    expect(owner.path).toBe('Root/HudInstance/Inner');
    expect(owner.parent?.parent).toBeUndefined();
    expect(ownerClaims(owner).get('%Gear')?.livePath).toBe('Root/HudInstance/Inner/Gear');
    expect(ownerClaims(ownerOf('Root/HudInstance/Sprite')).has('%Gear')).toBe(false);
  });
});
