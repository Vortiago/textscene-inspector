/**
 * A `[node]` whose `parent=` path names nothing still gets a diagnostic.
 *
 * `buildSceneTree` cannot place it, so Phase 2 walks a tree it is not in and
 * every semantic rule skips it AND its descendants without a word. Godot does
 * not merely drop it either: `SceneState::instantiate` warns "Parent path '…'
 * for node '…' has vanished when instantiating" and re-parents the node to the
 * scene root under `<parent path>#<name>` (`packed_scene.cpp:208-215`,
 * `:561-563`), so the engine reports it and the tier is a warning.
 */

import { describe, expect, it } from 'vitest';
import {
  expectNoDiagnostic,
  instanced,
  lint,
  node,
  packedScene,
  scene,
} from './testing/testkit.js';
import './index.js';

/** A StaticBody2D with no shape — the rule that proves Phase 2 reached a node. */
const NEEDS_SHAPE = 'staticbody2d-needs-collision-shape';
const ORPHAN = 'unresolved-parent-path';

const dangling = scene(
  node('Node2D', {}, { name: 'Root' }),
  node('StaticBody2D', {}, { name: 'Body', parent: 'NoSuchNode' })
);

const orphansIn = (source: string) => lint(source).filter((d) => d.ruleName === ORPHAN);

describe('a parent path this file never defines', () => {
  it('reports the node, its path, and the line its heading is on', () => {
    const orphans = orphansIn(dangling);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.severity).toBe('warning');
    expect(orphans[0]?.nodeName).toBe('Body');
    expect(orphans[0]?.message).toContain('NoSuchNode');
    expect(orphans[0]?.location?.line).toBe(5);
  });

  it('says the semantic rules did not run on it', () => {
    // The claim has to be this narrow: property validation happens during the
    // scan, so Phase 1 still covered the node's own values.
    expect(lint(dangling).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(false);
    const placed = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('StaticBody2D', {}, { name: 'Body', parent: '.' })
    );
    expect(lint(placed).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('reports every node in the stranded subtree, as Godot warns per node', () => {
    // `Child`'s own path resolves only THROUGH `Body`, which was never placed,
    // so Godot re-roots and renames both — one warning each.
    const names = orphansIn(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('StaticBody2D', {}, { name: 'Body', parent: 'NoSuchNode' }),
        node('StaticBody2D', {}, { name: 'Child', parent: 'NoSuchNode/Body' })
      )
    )
      .map((d) => d.nodeName)
      .sort();
    expect(names).toEqual(['Body', 'Child']);
  });

  it('errors on a second heading that declares no parent at all', () => {
    // `packed_scene.cpp:206` returns nullptr for the whole scene, so this one
    // does not load at all — a tier above the vanished-path case beside it.
    const errors = lint(
      scene(node('Node2D', {}, { name: 'Root' }), node('Node2D', {}, { name: 'Stray' }))
    ).filter((d) => d.ruleName === 'node-without-parent');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.severity).toBe('error');
    expect(errors[0]?.nodeName).toBe('Stray');
  });

  it('spells the re-parented name the way Godot does', () => {
    // `./` stripped, every `/` to `@`, then `#` and the node's own name.
    const nested = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('Node2D', {}, { name: 'Leaf', parent: 'Gone/Deeper' })
    );
    expect(orphansIn(nested)[0]?.message).toContain('"Gone@Deeper#Leaf"');
  });

  it('leaves a path that descends into instanced content alone', () => {
    // The intermediate names live in the sub-scene, not here, so the node is
    // anchored to the instance rather than stranded.
    expectNoDiagnostic(
      scene(
        packedScene,
        node('Node2D', {}, { name: 'Root' }),
        instanced('Player', { parent: '.' }),
        node('Sprite2D', {}, { name: 'Hat', parent: 'Player/Head' })
      ),
      { ruleName: ORPHAN }
    );
  });

  it('says nothing about a scene whose every parent path resolves', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', {}, { name: 'Mid', parent: '.' }),
        node('Sprite2D', {}, { name: 'Leaf', parent: 'Mid' })
      ),
      { ruleName: ORPHAN }
    );
  });
});
