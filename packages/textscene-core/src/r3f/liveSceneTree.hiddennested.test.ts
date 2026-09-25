/**
 * A `visible = false` override on an instance whose own root is an instance.
 * Neither heading carries a `type=`, so the override rides in `rawProperties`
 * until a level with a real type re-parses it, and one level of collapse stops
 * short of that level.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { collapseLiveNode, liveChildGroups, type CachedSceneSource } from './liveSceneTree';
import '../parser/TscnParser';

const LEAF = `[gd_scene load_steps=1 format=3]

[node name="Leaf" type="ColorRect"]
anchors_preset = 15
color = Color(1, 0, 0, 1)
`;

/** Its root is itself an instance, and it adds a child, which forces the nested topology. */
const INNER = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://leaf.tscn" id="1_l"]

[node name="Inner" instance=ExtResource("1_l")]
color = Color(1, 0, 0, 1)

[node name="Extra" type="ColorRect" parent="." index="0"]
anchors_preset = 15
color = Color(0, 0, 0, 1)
`;

const HOST = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="1_i"]

[node name="Root" type="Control"]
anchors_preset = 15

[node name="HiddenInstance" parent="." instance=ExtResource("1_i")]
visible = false
`;

describe('an instance chain collapses to fixed point', () => {
  const parser = new TscnParser();
  const host = parser.parse(HOST);
  const cache: CachedSceneSource = {
    getCached: (path) =>
      path === 'res://inner.tscn'
        ? parser.parse(INNER)
        : path === 'res://leaf.tscn'
          ? parser.parse(LEAF)
          : undefined,
  };
  const scope = { externalResources: host.externalResources, internalResources: host.internalResources };
  const hidden = host.nodes[0]!.children.find((c) => c.name === 'HiddenInstance')!;

  it('keeps the host’s visible=false through a nested instance root', () => {
    const collapsed = collapseLiveNode(hidden, scope, cache);
    expect(collapsed.properties.visible).toBe(false);
  });

  it('leaves no instance ref behind to collapse', () => {
    expect(collapseLiveNode(hidden, scope, cache).instance).toBeFalsy();
  });

  it('reports the same collapsed node through liveChildGroups', () => {
    const merged = liveChildGroups(hidden, scope, cache).find((g) => g.origin === 'merged');
    expect(merged?.mergedNode?.properties.visible).toBe(false);
  });
});
