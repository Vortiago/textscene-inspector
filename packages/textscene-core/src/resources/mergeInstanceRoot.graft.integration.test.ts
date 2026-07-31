/**
 * The `.tscn` half of the deep-override fix, end to end on real scenes.
 *
 * These three are the flavour that needs no renderer changes at all: once the
 * parser anchors the node at its instance and `mergeInstanceRoot` grafts it at
 * the recorded sub-path, the result is an ordinary `TscnNode` tree from that
 * point on. All three previously lost a VISIBLE node.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TscnParser } from '../parser/TscnParser';
import { mergeInstanceRoot } from './mergeInstanceRoot';
import type { TscnNode } from '../parser/types';

const SCENES = resolve(import.meta.dirname, '../../../../scenes');
const parse = (rel: string) => new TscnParser().parse(readFileSync(join(SCENES, rel), 'utf8'));

function find(nodes: readonly TscnNode[], name: string): TscnNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const found = find(n.children, name);
    if (found) return found;
  }
  return undefined;
}

describe('deep overrides through mergeInstanceRoot', () => {
  it('puts the pause menu’s extra Button inside the instanced menu, not beside it', () => {
    const host = parse('demos/2d/platformer/gui/pause_menu_singleplayer.tscn');
    const sub = parse('demos/2d/platformer/gui/pause_menu.tscn');

    const instanceNode = host.nodes[0]!;
    expect(instanceNode.children.map((c) => c.name)).toEqual(['SplitscreenButton']);
    expect(instanceNode.children[0]!.instanceSubPath).toBe(
      'ColorRect/CenterContainer/VBoxContainer'
    );

    const merged = mergeInstanceRoot(instanceNode, sub)!;
    const box = find([merged], 'VBoxContainer')!;
    expect(box.children.map((c) => c.name)).toContain('SplitscreenButton');
    // And it is NOT also sitting at the root, which is where it used to land
    // when the sub-path was ignored.
    expect(merged.children.map((c) => c.name)).not.toContain('SplitscreenButton');
  });

  it('carries the RPG opponent’s Body override through TWO nested instances', () => {
    // `Body` targets `Sprite2D/Pivot`, but `Sprite2D` is itself an instance, so
    // `Pivot` lives one scene deeper again. The first merge cannot resolve it —
    // it re-anchors with the remainder, and the second merge finishes the job.
    const host = parse('demos/2d/role_playing_game/combat/combatants/opponent.tscn');
    const combatant = parse('demos/2d/role_playing_game/combat/combatants/combatant.tscn');
    const sprite = parse('demos/2d/role_playing_game/combat/combatants/sprites/sprite.tscn');

    const body = host.nodes[0]!.children.find((c) => c.name === 'Body')!;
    expect(body.instanceSubPath).toBe('Sprite2D/Pivot');
    expect(body.overridesExistingNode).toBe(true);

    const merged = mergeInstanceRoot(host.nodes[0]!, combatant)!;
    const spriteNode = merged.children.find((c) => c.name === 'Sprite2D')!;
    expect(spriteNode.children.map((c) => c.name)).toContain('Body');
    expect(spriteNode.children.find((c) => c.name === 'Body')!.instanceSubPath).toBe('Pivot');

    const inner = mergeInstanceRoot(spriteNode, sprite)!;
    const pivot = find([inner], 'Pivot')!;
    // One Body carrying the host's authored texture — not two of the same name.
    const bodies = pivot.children.filter((c) => c.name === 'Body');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.rawProperties?.texture).toBe(body.rawProperties?.texture);
    // And the TYPED properties too, which is what components actually read —
    // merging the raw map alone would render as if the override never existed.
    expect((bodies[0]!.properties as { texture?: string }).texture).toBe(
      body.rawProperties?.texture
    );
  });

  it('stamps the host resource table onto a grafted node', () => {
    const host = parse('demos/2d/role_playing_game/combat/combatants/opponent.tscn');
    const sub = parse('demos/2d/role_playing_game/combat/combatants/combatant.tscn');

    const merged = mergeInstanceRoot(host.nodes[0]!, sub, host.externalResources)!;
    const body = find([merged], 'Body')!;

    // Its `texture = ExtResource(...)` id belongs to the OUTER table.
    expect(body.authoredResources).toBe(host.externalResources);
  });
});
