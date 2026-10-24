/**
 * A walk and a path question over one context take each node's child groups from the same place,
 * so a node collapses once for all of them. The groups are found by the node and its scope, never
 * by its path: two siblings may carry one name.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import {
  collectLiveNodes,
  resolveLiveEntry,
  type LiveTreeContext,
  type LiveTreeEntry,
} from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';

const KID = `[gd_scene format=3]

[node name="Kid" type="Node3D"]

[node name="Arm" type="Node3D" parent="."]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://kid.tscn" id="kid"]

[node name="Main" type="Node3D"]

[node name="K0" parent="." instance=ExtResource("kid")]

[node name="K0" parent="." instance=ExtResource("kid")]
`;

const parse = (text: string): TscnScene => new TscnParser().parse(text);

/** The context of `main`, with the kid scene cached. */
function contextWithKid(main: TscnScene): LiveTreeContext {
  return contextOver(main, { 'res://kid.tscn': parse(KID) });
}

function walk(main: TscnScene, ctx: LiveTreeContext): LiveTreeEntry[] {
  return collectLiveNodes(main.nodes, ctx, () => true);
}

describe('the child groups of a context', () => {
  it('give a second walk the nodes of the first', () => {
    const main = parse(MAIN);
    const ctx = contextWithKid(main);
    const first = walk(main, ctx);

    const second = walk(main, ctx);

    second.forEach((entry, i) => expect(entry.node).toBe(first[i]!.node));
  });

  it('give a path question the node a walk gave', () => {
    const main = parse(MAIN);
    const ctx = contextWithKid(main);
    const walked = walk(main, ctx).find((entry) => entry.path === 'Main/K0')!;

    expect(resolveLiveEntry('Main/K0', main.nodes, ctx)!.node).toBe(walked.node);
  });

  it('keep two siblings of one name apart', () => {
    const main = parse(MAIN);
    const entries = walk(main, contextWithKid(main)).filter((entry) => entry.path === 'Main/K0');

    expect(entries).toHaveLength(2);
    expect(entries[0]!.node).not.toBe(entries[1]!.node);
  });
});
