/** Tests for the shared NodePath-resolution helpers used by the semantic linters. */

import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { resolveNodePathTarget, findNodesByName } from './linterUtils.js';

function node(name: string, type: string, children: TscnNode[] = [], instance?: string): TscnNode {
  return { name, type, children, properties: {}, ...(instance ? { instance } : {}) };
}

describe('resolveNodePathTarget', () => {
  it('found: exactly one node matches the final segment', () => {
    const player = node('Player', 'AnimationPlayer');
    const tree = node('AnimTree', 'AnimationTree');
    const root = node('Root', 'Node3D', [player, tree]);

    const res = resolveNodePathTarget([root], tree, 'Player');
    expect(res.status).toBe('found');
    if (res.status === 'found') expect(res.node).toBe(player);
  });

  it('missing: no node matches the final segment', () => {
    const tree = node('AnimTree', 'AnimationTree');
    const root = node('Root', 'Node3D', [tree]);

    expect(resolveNodePathTarget([root], tree, 'Nope').status).toBe('missing');
  });

  it('ambiguous: more than one node shares the final-segment name', () => {
    // Godot allows repeated names across parents; the static linter must not
    // guess which "Player" the path means.
    const a = node('Player', 'Label3D');
    const b = node('Player', 'AnimationPlayer');
    const tree = node('AnimTree', 'AnimationTree');
    const root = node('Root', 'Node3D', [node('A', 'Node3D', [a]), node('B', 'Node3D', [b]), tree]);

    expect(resolveNodePathTarget([root], tree, 'Player').status).toBe('ambiguous');
  });

  it('escapes: a ".." segment leaves the authored scope', () => {
    const tree = node('AnimTree', 'AnimationTree');
    const root = node('Root', 'Node3D', [tree]);

    expect(resolveNodePathTarget([root], tree, '../Sibling/Player').status).toBe('escapes');
  });

  it('escapes: the referencing node sits under an instanced sub-scene', () => {
    const tree = node('AnimTree', 'AnimationTree');
    const rig = node('Rig', '', [tree], 'ExtResource("1")'); // instance= → internals unseen
    const root = node('Root', 'Node3D', [rig]);

    expect(resolveNodePathTarget([root], tree, 'Player').status).toBe('escapes');
  });

  it('resolves on the FINAL segment only (the path prefix is not walked)', () => {
    // Documents the deliberate static-scope simplification: a single matching
    // final segment resolves even if the prefix names do not line up.
    const skeleton = node('Skeleton3D', 'Skeleton3D');
    const mesh = node('Mesh', 'MeshInstance3D');
    const root = node('Root', 'Node3D', [skeleton, mesh]);

    const res = resolveNodePathTarget([root], mesh, 'Armature/Skeleton3D');
    expect(res.status).toBe('found');
    if (res.status === 'found') expect(res.node).toBe(skeleton);
  });
});

describe('findNodesByName', () => {
  it('collects every match depth-first', () => {
    const a = node('X', 'Node3D');
    const b = node('X', 'Label3D');
    const root = node('Root', 'Node3D', [a, node('G', 'Node3D', [b])]);

    expect(findNodesByName([root], 'X')).toEqual([a, b]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findNodesByName([node('Root', 'Node3D')], 'Nope')).toEqual([]);
  });
});
