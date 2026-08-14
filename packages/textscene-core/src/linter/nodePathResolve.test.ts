/**
 * The resolver is a port, so every case here quotes the line it reproduces.
 *
 * The bug it was written against: matching a path's final segment against every
 * name in the scene. `Node::get_node_or_null` walks `data.children.getptr(name)`
 * from the referencing node (node.cpp:1941), so a bare name can only ever reach
 * that node's OWN child — which makes the name-anywhere form wrong in both
 * directions at once, silent on a dangling path and loud on a working one.
 */

import { describe, expect, it } from 'vitest';
import { resolveNodePath } from './nodePathResolve.js';
import type { TscnNode, TscnScene } from '../parser/types.js';

function node(
  name: string,
  children: TscnNode[] = [],
  extra: Partial<TscnNode> = {}
): TscnNode {
  return { name, type: 'Node3D', properties: {}, children, ...extra } as TscnNode;
}

const sceneOf = (...roots: TscnNode[]): TscnScene => ({ nodes: roots }) as TscnScene;

/** Find a node by name for the test's own bookkeeping, not for resolution. */
function pick(roots: TscnNode[], name: string): TscnNode {
  for (const n of roots) {
    if (n.name === name) return n;
    try {
      return pick(n.children, name);
    } catch {
      // keep looking
    }
  }
  throw new Error(`no node named ${name}`);
}

describe('resolveNodePath', () => {
  describe('a bare name means a DIRECT child (node.cpp:1941)', () => {
    it('finds the referencing node’s own child', () => {
      const tree = node('Root', [node('Body', [node('Mesh')])]);
      const scene = sceneOf(tree);
      const body = pick([tree], 'Body');
      expect(resolveNodePath(scene, body, 'Mesh')).toEqual({
        status: 'found',
        node: pick([tree], 'Mesh'),
      });
    });

    // The case the old name-anywhere match got backwards: `ParentNode` exists in
    // the file, but not as a child of the node doing the referencing, so
    // `data.children.getptr` returns null and the engine's ERR_FAIL fires.
    it('does NOT reach the referencing node’s own parent', () => {
      const tree = node('ParentNode', [node('ChildNode')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'ChildNode'), 'ParentNode')).toEqual({
        status: 'missing',
      });
    });

    it('does NOT reach a sibling', () => {
      const tree = node('Root', [node('A'), node('B')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'A'), 'B')).toEqual({ status: 'missing' });
    });

    it('does NOT reach an unrelated branch that shares the name', () => {
      const tree = node('Root', [node('Left', [node('Target')]), node('Right')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Right'), 'Target')).toEqual({
        status: 'missing',
      });
    });

    it('walks several segments in order', () => {
      const tree = node('Root', [node('A', [node('B', [node('C')])])]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'A/B/C')).toEqual({
        status: 'found',
        node: pick([tree], 'C'),
      });
    });
  });

  describe('. and .. (node.cpp:1916-1924)', () => {
    it('resolves "." to the referencing node itself', () => {
      const tree = node('Root', [node('A')]);
      const scene = sceneOf(tree);
      const a = pick([tree], 'A');
      expect(resolveNodePath(scene, a, '.')).toEqual({ status: 'found', node: a });
    });

    it('climbs with ".." and then descends', () => {
      const tree = node('Root', [node('A'), node('B')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'A'), '../B')).toEqual({
        status: 'found',
        node: pick([tree], 'B'),
      });
    });

    // `:1920-1922` returns null, and standalone in the editor that is what
    // happens. But the authored root is only the runtime root while the scene is
    // open on its own, so climbing past it is declined rather than reported.
    it('declines when ".." runs off the authored root', () => {
      const tree = node('Root');
      expect(resolveNodePath(sceneOf(tree), tree, '..')).toEqual({ status: 'unknowable' });
    });

    it('climbs ".." past a parent whose own type this file never states', () => {
      // `..` is `get_parent()` (node.cpp:1920) and never reads the parent's
      // class, so a property-override heading is a node this file names
      // perfectly well. Declining here stopped the walk and silenced every rule
      // that would have judged where the path finally lands.
      const target = node('Target');
      const tree = node('Root', [
        node('Mid', [node('Leaf'), target], { type: '', overridesExistingNode: true }),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Leaf'), '../Target')).toEqual({
        status: 'found',
        node: target,
      });
    });

    it('still reports a miss reached through such a ".."', () => {
      const tree = node('Root', [
        node('Mid', [node('Leaf')], { type: '', overridesExistingNode: true }),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Leaf'), '../Nope')).toEqual({
        status: 'unknowable',
      });
    });

    it('declines a path that climbs past the root before descending', () => {
      const tree = node('Root', [node('A')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'A'), '../../Elsewhere')).toEqual({
        status: 'unknowable',
      });
    });
  });

  describe('%unique names (node.cpp:1930-1938)', () => {
    const withUnique = () =>
      node('Root', [
        node('Deep', [node('Marker', [], { properties: { unique_name_in_owner: true } })]),
        node('Other'),
      ]);

    it('resolves from anywhere, since the owner holds the map', () => {
      const tree = withUnique();
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Other'), '%Marker')).toEqual({
        status: 'found',
        node: pick([tree], 'Marker'),
      });
    });

    it('accepts the serialised string spelling of the flag', () => {
      const tree = node('Root', [
        node('Marker', [], { properties: { unique_name_in_owner: 'true' } }),
        node('Other'),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Other'), '%Marker').status).toBe('found');
    });

    // A node named Marker without the flag claims nothing: the map is keyed by
    // `_acquire_unique_name_in_owner`, not by name.
    it('is missing when no node claims the unique name', () => {
      const tree = node('Root', [node('Marker'), node('Other')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Other'), '%Marker')).toEqual({
        status: 'missing',
      });
    });

    it('continues walking below the unique node', () => {
      const tree = node('Root', [
        node('Rig', [node('Hand')], { properties: { unique_name_in_owner: true } }),
        node('Other'),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Other'), '%Rig/Hand')).toEqual({
        status: 'found',
        node: pick([tree], 'Hand'),
      });
    });
  });

  describe('what a static reader must decline', () => {
    it('declines walking INTO an instance, whose children are in another file', () => {
      const tree = node('Root', [node('Enemy', [], { instance: 'ExtResource("1_enemy")' })]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'Enemy/Hitbox')).toEqual({ status: 'unknowable' });
    });

    // An `instance=` heading declares a PackedScene, never a class, so
    // `StrictTscnParser` puts the `ExtResource("…")` literal in `type`. Handing
    // that to `descendsFrom` reports a Godot-valid target as the wrong type.
    it('declines a path that lands ON an instance, whose class is in another file', () => {
      const tree = node('Root', [node('Pistol', [], { instance: 'ExtResource("8")' })]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'Pistol')).toEqual({ status: 'unknowable' });
    });

    it('still finds an authored child under an instance (an editable override)', () => {
      const tree = node('Root', [
        node('Enemy', [node('Extra')], { instance: 'ExtResource("1_enemy")' }),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'Enemy/Extra')).toEqual({
        status: 'found',
        node: pick([tree], 'Extra'),
      });
    });

    // A heading with neither `type=` nor `instance=` overrides a node declared
    // inside the instance, so ITS children are in the other file too.
    it('declines a miss below a property-override heading', () => {
      const tree = node('Root', [
        node('Enemy', [node('Body', [], { type: '', overridesExistingNode: true })], {
          instance: 'ExtResource("1_enemy")',
        }),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'Enemy/Body/Sprite')).toEqual({ status: 'unknowable' });
    });

    it('declines when the referencing node itself sits under an instance', () => {
      const tree = node('Root', [
        node('Enemy', [node('Inner')], { instance: 'ExtResource("1_enemy")' }),
      ]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'Inner'), 'Nope')).toEqual({
        status: 'unknowable',
      });
    });

    // `ERR_FAIL_COND_V_MSG(!data.tree && p_path.is_absolute(), ...)` (:1898): an
    // absolute path is measured from the live SceneTree root, which is above this
    // file's own root once autoloads and the main scene exist.
    it('declines an absolute path', () => {
      const tree = node('Root', [node('A')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, pick([tree], 'A'), '/root/Main')).toEqual({
        status: 'unknowable',
      });
    });
  });

  describe('path shapes', () => {
    it('is missing for the empty path (node.cpp:1894)', () => {
      const tree = node('Root');
      expect(resolveNodePath(sceneOf(tree), tree, '')).toEqual({ status: 'missing' });
    });

    // `get_node_or_null` loops over `get_name_count()` only (:1912); a subname
    // addresses a property on the resolved node.
    it('ignores a :property subname', () => {
      const tree = node('Root', [node('A')]);
      const scene = sceneOf(tree);
      expect(resolveNodePath(scene, tree, 'A:position')).toEqual({
        status: 'found',
        node: pick([tree], 'A'),
      });
    });

    // `is_empty()` is `!data`, so a subname-only path is NOT empty: the loop runs
    // zero times and `current` is still the referencing node.
    it('resolves a subname-only path to the referencing node', () => {
      const tree = node('Root', [node('A')]);
      const scene = sceneOf(tree);
      const a = pick([tree], 'A');
      expect(resolveNodePath(scene, a, ':position')).toEqual({ status: 'found', node: a });
    });
  });
});
