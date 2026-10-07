/**
 * Overrides in the live scene tree, on the RPG demo's opponent: each overridden property
 * resolves its ids in the file that wrote it, as Godot's loader does per file
 * (`resource_format_text.cpp:125-151`). The opponent, the combatant and the sprite each
 * number their ExtResources from 1, so a property resolved in the wrong file names another
 * resource.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TscnParser } from '../parser/TscnParser';
import { extResourcePathOf } from '../resources/testing/extResourcePathOf';
import { findSubResource } from '../resources/SubResourceResolver';
import { resourceRef } from '../godot/resourceRef';
import { liveChildGroups, rootScope, type LiveChildGroup, type LiveTreeContext } from './liveSceneTree';
import type { SceneScope } from '../parser/types';
import { scopeOf, type LiveNode } from '../resources/liveNode';

const DEMO = resolve(import.meta.dirname, '../../../../scenes/demos/2d/role_playing_game');
const parse = (rel: string) => new TscnParser().parse(readFileSync(join(DEMO, rel), 'utf8'));

const opponent = parse('combat/combatants/opponent.tscn');
const ctx: LiveTreeContext = {
  externalResources: opponent.externalResources,
  sceneCache: {
    getCached: (path) =>
      ({
        'res://combat/combatants/combatant.tscn': parse('combat/combatants/combatant.tscn'),
        'res://combat/combatants/sprites/sprite.tscn': parse('combat/combatants/sprites/sprite.tscn'),
      })[path],
  },
};

/** The collapsed live node at `path` and the scope its own refs resolve against, by the walk `liveChildGroups` makes. */
function liveNodeAt(path: string): { node: LiveNode; scope: SceneScope } {
  let groups: readonly LiveChildGroup[] = [
    { origin: 'inline', children: opponent.nodes, scope: rootScope(ctx) },
  ];
  let found: { node: LiveNode; scope: SceneScope } | undefined;
  for (const segment of path.split('/')) {
    const group = groups.find((g) => g.children.some((n) => n.name === segment))!;
    const node = group.children.find((n) => n.name === segment)!;
    groups = liveChildGroups(node, group.scope, ctx.sceneCache);
    const collapsed = groups[0]?.mergedNode ?? node;
    found = { node: collapsed, scope: scopeOf(collapsed, group.scope) };
  }
  return found!;
}

/** The path the raw `key` of the live node at `path` resolves to. */
function resolvedPath(path: string, key: string): string | undefined {
  const { node, scope } = liveNodeAt(path);
  return extResourcePathOf(node.rawProperties?.[key], scope);
}

describe('overrides in the live scene tree', () => {
  it('resolves an instance root override in the outer scene', () => {
    // `script = ExtResource("2")` on the opponent; the combatant's `2` is health.gd.
    expect(resolvedPath('Opponent', 'script')).toBe('res://combat/combatants/opponent.gd');
  });

  it('resolves a deep override in the outer scene through two nested instances', () => {
    // `texture = ExtResource("3")` on `Sprite2D/Pivot/Body`; the combatant's `3` is sprite.tscn.
    expect(resolvedPath('Opponent/Sprite2D/Pivot/Body', 'texture')).toBe(
      'res://combat/combatants/sprites/opponent_battle.png'
    );
  });

  it('keeps a sibling of the overridden node in its own scene', () => {
    expect(resolvedPath('Opponent/Sprite2D/Pivot/Shadow', 'texture')).toBe(
      'res://combat/combatants/sprites/shadow.png'
    );
  });
});

describe('an instance override that names a SubResource of the root scene', () => {
  const host = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="sub"]

[sub_resource type="StandardMaterial3D" id="2"]
albedo_color = Color(1, 0, 0, 1)

[node name="Instanced" instance=ExtResource("sub")]
material_override = SubResource("2")
`);
  const sub = new TscnParser().parse(`[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="2"]
albedo_color = Color(0, 0, 1, 1)

[node name="SubRoot" type="MeshInstance3D"]
material_override = SubResource("2")
`);

  it('resolves it to the root scene’s resource, as the viewport does', () => {
    const hostCtx: LiveTreeContext = {
      externalResources: host.externalResources,
      internalResources: host.internalResources,
      sceneCache: { getCached: (path) => (path === 'res://sub.tscn' ? sub : undefined) },
    };
    const [group] = liveChildGroups(host.nodes[0]!, rootScope(hostCtx), hostCtx.sceneCache);
    const merged = group!.mergedNode!;
    const id = resourceRef(merged.rawProperties!.material_override!)!.id;

    expect(findSubResource(scopeOf(merged, group!.scope).internalResources, id)?.data.albedo_color).toBe(
      'Color(1, 0, 0, 1)'
    );
  });
});
