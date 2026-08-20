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

/**
 * No heading omits `parent=`, so heading 0 becomes the root while declaring one.
 */
const ROOTLESS = scene(
  node('Node2D', {}, { name: 'A', parent: '.' }),
  node('Node2D', {}, { name: 'B', parent: 'A' })
);

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

  it('reads an empty parent= as a vanished PATH, not as a missing field', () => {
    // The loader calls `add_node_path` for any value the field carries and it
    // never returns -1 (`packed_scene.cpp:2307-2311`), so `n.parent == -1` — the
    // refusal `node-without-parent` cites — cannot apply to this heading.
    const empty = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('Node2D', {}, { name: 'B', parent: '' })
    );
    const orphans = orphansIn(empty);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.severity).toBe('warning');
    expect(lint(empty).filter((d) => d.ruleName === 'node-without-parent')).toEqual([]);
  });

  it('still names the headings a file with no root heading strands', () => {
    // `packed_scene.cpp:218-219` makes heading 0 the root and fails the
    // instantiate when it declares a parent, so handing the flat list back as
    // roots made every node reachable and the report said nothing at all. B
    // keeps its own warning beside the root's error: the two name different
    // headings, and the root's refusal is not a restatement of B's path.
    expect(orphansIn(ROOTLESS).map((d) => d.nodeName)).toEqual(['B']);
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

describe('a root heading that declares a parent', () => {
  const rootErrors = (source: string) =>
    lint(source).filter((d) => d.ruleName === 'root-declares-parent');

  it('is an error naming the heading and the parent it declares', () => {
    const errors = rootErrors(ROOTLESS);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.severity).toBe('error');
    expect(errors[0]?.nodeName).toBe('A');
    expect(errors[0]?.message).toContain('parent="."');
    expect(errors[0]?.location?.line).toBe(3);
  });

  it('reports an empty parent= on the root, which no heading omits', () => {
    // `add_node_path` returns an index for a value the field carries, so this
    // heading reaches `:219` with `n.parent != -1` exactly as `parent="."` does
    // — even though both parsers leave `node.parent` unset for it.
    expect(
      rootErrors(scene(node('Node2D', {}, { name: 'A', parent: '' }))).map((d) => d.severity)
    ).toEqual(['error']);
  });

  it('names the FIRST heading, not whichever one the tree build rooted at', () => {
    // `buildSceneTree` prefers a parentless heading wherever it sits, so here it
    // roots at `Root` and seats `A` beneath it — a tree with nothing wrong in
    // it. Godot's root is `i == 0` regardless, so `A` is still the refusal.
    const errors = rootErrors(
      scene(node('Node2D', {}, { name: 'A', parent: '.' }), node('Node2D', {}, { name: 'Root' }))
    );
    expect(errors.map((d) => d.nodeName)).toEqual(['A']);
  });

  it('leaves the vanished-path warning off heading 0, which never reaches it', () => {
    // `packed_scene.cpp:200-219` is `if (i > 0) { … } else { … }`, and the
    // WARN_PRINT with its `nparent = ret_nodes[0]` re-root sits in the `i > 0`
    // arm alone. Heading 0 is refused at `:219` instead, so a warning naming a
    // rename Godot never performs on it describes nothing the engine does.
    const vanished = scene(
      node('Node2D', {}, { name: 'A', parent: 'Nope' }),
      node('Node2D', {}, { name: 'Root' })
    );
    expect(orphansIn(vanished)).toEqual([]);
    expect(rootErrors(vanished).map((d) => d.nodeName)).toEqual(['A']);
  });

  it('says nothing about a root heading that declares none', () => {
    expect(rootErrors(scene(node('Node2D', {}, { name: 'Root' })))).toEqual([]);
    expect(rootErrors(dangling)).toEqual([]);
  });
});
