/**
 * The MultiplayerSpawner spawn_path rule (`multiplayerspawner-spawn-path-dangling`), driven through
 * `StrictTscnParser` and the rule's own `check`, not `Linter`, which loads every slice through the
 * linter barrel. The parse is the real one, so the rule reads what a scene produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import { multiplayerSpawnerSpawnPathRule } from './linter';
import './linterParser';

/** Every diagnostic the rule reports for the MultiplayerSpawner in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error('fixture failed to parse');
  const node = scene.nodes[0]?.children.find((child) => child.type === 'MultiplayerSpawner');
  expect(node, 'the fixture text must contain a MultiplayerSpawner child').toBeDefined();
  return multiplayerSpawnerSpawnPathRule.check({ scene, node: node!, properties: node!.properties });
}

/** A MultiplayerSpawner carrying `body`, with a child named SpawnRoot to point at. */
function scene(body: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Spawner" type="MultiplayerSpawner" parent="."]
${body}
[node name="SpawnRoot" type="Node" parent="Spawner"]
`;
}

describe('MultiplayerSpawner spawn_path rule', () => {
  it('stays silent when spawn_path is absent (default-omitted: default is empty)', () => {
    expect(warningsFor(scene(''))).toEqual([]);
  });

  it('stays silent on an explicit empty NodePath, same as the default', () => {
    expect(warningsFor(scene('spawn_path = NodePath("")\n'))).toEqual([]);
  });

  it('stays silent when spawn_path resolves to a real node', () => {
    expect(warningsFor(scene('spawn_path = NodePath("SpawnRoot")\n'))).toEqual([]);
  });

  it('warns when spawn_path names no node in this file', () => {
    const warnings = warningsFor(scene('spawn_path = NodePath("NoSuchNode")\n'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.ruleName).toBe('multiplayerspawner-spawn-path-dangling');
    expect(warnings[0]?.message).toContain('NoSuchNode');
  });

  // `..` is not itself unresolvable: the walk climbs to Root and asks it for a
  // child named Elsewhere (node.cpp:1941). Root has only the Spawner, so
  // `has_node` is false (multiplayer_spawner.cpp:91) and Godot warns too.
  it('warns on a relative path whose next segment names no child', () => {
    const warnings = warningsFor(scene('spawn_path = NodePath("../Elsewhere")\n'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('Elsewhere');
  });

  // The genuine decline: the path walks into instanced content, whose children
  // live in another file, so a miss here is the linter's blindness, not Godot's null.
  it('stays silent when the path descends into an instanced sub-scene', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://level.tscn" id="1_level"]

[node name="Root" type="Node"]

[node name="Spawner" type="MultiplayerSpawner" parent="."]
spawn_path = NodePath("../Level/Spawns")

[node name="Level" parent="." instance=ExtResource("1_level")]
`;
    expect(warningsFor(content)).toEqual([]);
  });

  it('leaves the committed fixture warning-free', () => {
    // expectFixtureClean runs validators only; rules never reach it. This is
    // the half of the fixture's "zero warnings" claim nothing else checks.
    expect(warningsFor(readFixture('unit-multiplayer-spawner.tscn'))).toEqual([]);
  });
});
