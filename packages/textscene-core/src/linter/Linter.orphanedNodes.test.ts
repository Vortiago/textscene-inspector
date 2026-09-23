/**
 * A `[node]` whose `parent=` path names nothing still gets a diagnostic: `buildSceneTree` cannot place it, so every
 * semantic rule would skip it and its descendants silently. Godot warns "Parent path '…' for node '…' has vanished when
 * instantiating" and re-parents it to the scene root as `<parent path>#<name>` (`packed_scene.cpp:208-215`, `:561-563`),
 * so the tier is a warning.
 */

import { describe, expect, it } from 'vitest';
import {
  expectNoDiagnostic,
  instanced,
  lint,
  node,
  override,
  packedScene,
  scene,
} from './testing/testkit.js';
import './index.js';

/** A StaticBody2D with no shape: the rule that proves Phase 2 reached a node. */
const NEEDS_SHAPE = 'collisionobject2d-needs-collision-shape';
const ORPHAN = 'unresolved-parent-path';

const dangling = scene(
  node('Node2D', {}, { name: 'Root' }),
  node('StaticBody2D', {}, { name: 'Body', parent: 'NoSuchNode' })
);

const orphansIn = (source: string) => lint(source).filter((d) => d.ruleName === ORPHAN);

/** `parent=""`: a path the loader keeps and `get_node_or_null` resolves to nothing. */
const EMPTY_PARENT = scene(
  node('Node2D', {}, { name: 'Root' }),
  node('Node2D', {}, { name: 'B', parent: '' })
);

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
    // `Child`'s own path resolves only through `Body`, which was never placed,
    // so Godot re-roots and renames both, one warning each.
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
    // does not load at all, a tier above the vanished-path case beside it.
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
    expect(orphansIn(nested)[0]?.message).toContain('"Gone_Deeper#Leaf"');
  });

  it.each([
    ['Gone/', 'Gone#Leaf'],
    ['Gone//Deeper', 'Gone_Deeper#Leaf'],
    ['/root/Gone', '___root_Gone#Leaf'],
  ])('prefixes with the NodePath spelling of %s, not the heading text', (parent, renamed) => {
    // `:212` prefixes with `String(node_paths[…])`: the NodePath constructor drops empty segments (`node_path.cpp:428-438`)
    // and keeps a leading `/` for an absolute path (`:176-177`), and the loader's leading `.` (`resource_format_text.cpp:207`)
    // cancels against `trim_prefix("./")` for a relative path only. `set_name` then replaces every `@` and `.` with `_`
    // (`node.cpp:1441`).
    const message = orphansIn(
      scene(node('Node2D', {}, { name: 'Root' }), node('Node2D', {}, { name: 'Leaf', parent }))
    )[0]?.message;
    expect(message).toContain(`"${renamed}"`);
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

  it('leaves a path descending through an OVERRIDE heading alone', () => {
    // The editable-children shape Godot writes constantly: `Inside` has no `type=` because the node already exists in the
    // instanced scene, so the path resolves at runtime and a warning would fire on the most ordinary composition.
    expectNoDiagnostic(
      scene(
        packedScene,
        node('Node2D', {}, { name: 'Root' }),
        instanced('Building', { parent: '.' }),
        override('Inside', 0, { parent: 'Building' }),
        node('CollisionPolygon2D', {}, { name: 'Poly', parent: 'Building/Inside/StaticBody2D' })
      ),
      { ruleName: ORPHAN }
    );
  });

  it('leaves a path descending through an override below an instanced ROOT alone', () => {
    // The inherited scene: every heading after the root overrides base-scene
    // content, so the opacity starts at the scene root.
    expectNoDiagnostic(
      scene(
        packedScene,
        instanced('Root'),
        override('Mid', 0, { parent: '.' }),
        node('Sprite2D', {}, { name: 'Leaf', parent: 'Mid/Ghost' })
      ),
      { ruleName: ORPHAN }
    );
  });

  it('follows a %Name in a parent= to the node that claims it', () => {
    // Godot's serialiser writes `parent_path.simplified()` and never emits one (`resource_format_text.cpp:2018`), but the
    // loader resolves it: `get_node_or_null` looks `%Name` up in the owner's claim table (`node.cpp:1930-1938`). Probed on
    // 4.7.2: with the flag, `Hat` lands at `Root/Player/Hat`.
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', { unique_name_in_owner: true }, { name: 'Player', parent: '.' }),
        node('Node2D', {}, { name: 'Hat', parent: '%Player' })
      ),
      { ruleName: ORPHAN }
    );
  });

  it('warns on a %Name whose claim is declared later, as Godot does', () => {
    // Same two headings, swapped: the claim table holds only what the earlier
    // headings seated, so 4.7.2 warns the path vanished and renames the node.
    const message = orphansIn(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', {}, { name: 'Hat', parent: '%Player' }),
        node('Node2D', { unique_name_in_owner: true }, { name: 'Player', parent: '.' })
      )
    )[0]?.message;
    expect(message).toContain('"_Player#Hat"');
  });

  it('strands a %Name nothing claims, which Godot re-roots', () => {
    // The other half of the same probe: drop `unique_name_in_owner` and 4.7.2
    // warns "Parent path './%Player' for node 'Hat' has vanished" and renames
    // it `_Player#Hat`: the `%` is one of the characters `validate_node_name`
    // replaces (`ustring.cpp:5119-5131`).
    const message = orphansIn(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', {}, { name: 'Player', parent: '.' }),
        node('Node2D', {}, { name: 'Hat', parent: '%Player' })
      )
    )[0]?.message;
    expect(message).toContain('"_Player#Hat"');
  });

  it('reports no type for an override heading, rather than its index=', () => {
    // `index=` is the sibling position Godot restores the override at, not a
    // type. The parse-side arm on the same heading reads
    // `heading.attributes.type` and already says `<unknown>`.
    const diagnostic = lint(
      scene(node('Node2D', {}, { name: 'Root' }), override('Pivot', 2, { parent: 'NoSuchNode' }))
    ).find((d) => d.ruleName === ORPHAN);
    expect(diagnostic?.nodeType).toBe('<unknown>');
  });

  it('claims no re-root when the heading carries parent_id_path', () => {
    // `NODE_FROM_ID` falls back to `_recover_node_path_index` before the vanished-path warning (`packed_scene.cpp:161-163`,
    // `:1947`), which walks ids through base scenes this linter never opens. So an unwalkable path here does not settle
    // where the node lands, and the rename is not asserted.
    const source = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Body" type="Node2D" parent="Gone" parent_id_path=PackedInt32Array(840561040, 1598164129)]
`;
    const message = orphansIn(source)[0]?.message;
    expect(message).toContain('parent_id_path');
    expect(message).not.toContain('Gone#Body');
  });

  it('errors on an empty parent=, which is neither a vanished path nor a missing field', () => {
    // `add_node_path` never returns -1 (`packed_scene.cpp:2307-2311`), so the `n.parent == -1` refusal `node-without-parent`
    // cites cannot apply. The load faults first: `prepend_period()` (`resource_format_text.cpp:207`) dereferences data an
    // empty NodePath does not allocate (`node_path.cpp:43-44`, `:394-397`). On Godot 4.7.2 `load()` crashes with SIGSEGV.
    const diagnostics = lint(EMPTY_PARENT);
    const empties = diagnostics.filter((d) => d.ruleName === 'empty-parent-path');
    expect(empties).toHaveLength(1);
    expect(empties[0]?.severity).toBe('error');
    expect(empties[0]?.nodeName).toBe('B');
    expect(orphansIn(EMPTY_PARENT)).toEqual([]);
    expect(diagnostics.filter((d) => d.ruleName === 'node-without-parent')).toEqual([]);
  });

  it('says the LOAD failed, not the instantiate, for a node stranded beside an empty path', () => {
    // `parent=""` faults `prepend_period()` while the loader is still reading
    // headings (`resource_format_text.cpp:206-207`), so the instantiate the
    // re-root belongs to is never reached, and a "refuses to instantiate" verb
    // here names a stage the file never got to.
    const message = orphansIn(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', {}, { name: 'B', parent: '' }),
        node('Node2D', {}, { name: 'Stray', parent: 'NoSuchNode' })
      )
    )[0]?.message;
    expect(message).toContain('cannot load the file at all');
    expect(message).not.toContain('instantiate the scene for another heading');
  });

  it('claims no re-root for the empty path, since nothing in the file is read', () => {
    const message = lint(EMPTY_PARENT).find((d) => d.ruleName === 'empty-parent-path')?.message;
    expect(message).toContain('cannot load the file');
    expect(message).not.toContain('#B');
  });

  it('reports an empty parent= the tree build seated as a root, not only a stranded one', () => {
    // `parent=""` leaves `node.parent` unset, so `buildSceneTree` picks this
    // heading as its root and nothing strands it, while the loader faults on
    // it all the same. Verified against Godot 4.7.2: `load()` crashes.
    const source = scene(
      node('Node2D', {}, { name: 'A', parent: '.' }),
      node('Node2D', {}, { name: 'B', parent: '' })
    );
    expect(
      lint(source)
        .filter((d) => d.ruleName === 'empty-parent-path')
        .map((d) => d.nodeName)
    ).toEqual(['B']);
  });

  it.each([['index="0"'], ['instance_placeholder="res://x.tscn"']])(
    'claims no re-root when the root heading carries only %s',
    (attribute) => {
      // Neither is a `type=` or an `instance=`, so `:220` refuses the
      // instantiate (and a placeholder root fails the load outright at
      // `resource_format_text.cpp:247-251`). Verified against Godot 4.7.2:
      // both return null.
      const source = scene(
        `[node name="Root" ${attribute}]`,
        node('StaticBody2D', {}, { name: 'Body', parent: 'Gone' })
      );
      const orphan = orphansIn(source)[0];
      expect(orphan?.message).toContain('refuses');
      expect(orphan?.message).not.toContain('renames');
    }
  );

  it('claims no re-root when the root heading states no type= or instance=', () => {
    // `packed_scene.cpp:220` fails at i == 0 on the missing base scene, before
    // any node is built. Verified against Godot 4.7.2: instantiate returns null
    // with `"root node Root in an instance, but there's no base scene."`
    const source = scene(
      '[node name="Root"]',
      node('StaticBody2D', {}, { name: 'Body', parent: 'Gone' })
    );
    const orphan = orphansIn(source)[0];
    expect(orphan?.message).toContain('refuses');
    expect(orphan?.message).not.toContain('renames');
  });

  it('still names the headings a file with no root heading strands', () => {
    // `packed_scene.cpp:218-219` makes heading 0 the root and fails the instantiate when it declares a parent, so the
    // flat list is not handed back as roots, which would make every node reachable and silent. B keeps its own warning
    // beside the root's error: the two name different headings.
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

  it('yields to the empty path on the root, which the loader never reads that far', () => {
    // `:219` is an instantiate refusal and `parent=""` faults the load before
    // any of them (`resource_format_text.cpp:206-207`), so claiming this
    // heading reaches `n.parent != -1` would describe something Godot never
    // does. Verified against Godot 4.7.2: `load()` on this file crashes.
    const source = scene(node('Node2D', {}, { name: 'A', parent: '' }));
    expect(rootErrors(source)).toEqual([]);
    expect(
      lint(source)
        .filter((d) => d.ruleName === 'empty-parent-path')
        .map((d) => [d.severity, d.nodeName])
    ).toEqual([['error', 'A']]);
  });

  it('names the FIRST heading, not whichever one the tree build rooted at', () => {
    // `buildSceneTree` prefers a parentless heading wherever it sits, so here it
    // roots at `Root` and seats `A` beneath it, a tree with nothing wrong in
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

describe('a vanished path beside an instantiate refusal', () => {
  // The re-root at `packed_scene.cpp:208-215` runs inside the loop that
  // `ERR_FAIL_COND_V_MSG(n.parent == -1, nullptr, …)` (:207) and the root's
  // own `n.parent != -1` refusal (:218) return out of, so after any heading
  // refuses the instantiate, no re-parent or rename survives to describe.
  it('does not claim a re-root when another heading is parentless', () => {
    const [orphan] = orphansIn(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Node2D', {}, { name: 'B' }),
        node('Node2D', {}, { name: 'C', parent: 'Nope' })
      )
    );
    expect(orphan?.nodeName).toBe('C');
    expect(orphan?.message).not.toContain('re-parents');
    expect(orphan?.message).not.toContain('Nope#C');
    expect(orphan?.message).toContain('refuses');
  });

  it('does not claim a re-root when the root declares a parent', () => {
    const [orphan] = orphansIn(
      scene(
        node('Node2D', {}, { name: 'A', parent: '.' }),
        node('Node2D', {}, { name: 'C', parent: 'Nope' })
      )
    );
    expect(orphan?.nodeName).toBe('C');
    expect(orphan?.message).not.toContain('re-parents');
    expect(orphan?.message).toContain('refuses');
  });
});

describe('a parent path Godot folds as it walks', () => {
  // `NODE_FROM_ID` resolves the stored NodePath with `ret_nodes[0]->get_node_or_null(np)` (`packed_scene.cpp:161`), so
  // every fold applies: no name from an empty segment (`node_path.cpp:428-438`), `.` stays and `..` steps up
  // (`node.cpp:1916-1924`). Each case asserts both halves: no `unresolved-parent-path`, and
  // `collisionobject2d-needs-collision-shape` firing to show Phase 2 walked a tree the node is in.
  const placedUnder = (parent: string) =>
    scene(
      node('Node2D', {}, { name: 'Root' }),
      node('Node2D', {}, { name: 'Mid', parent: '.' }),
      node('StaticBody2D', {}, { name: 'Body', parent })
    );

  it.each([
    ['./Mid', 'a leading . stays on the root'],
    ['Mid/', 'a trailing slash names no segment'],
    ['Mid//', 'neither does a doubled one'],
    ['./Mid/.', 'nor does a . in the middle'],
    ['Mid:position', 'a :subname addresses a property, not a node'],
  ])('places a node under %s — %s', (parent) => {
    const source = placedUnder(parent);
    expect(orphansIn(source)).toEqual([]);
    expect(lint(source).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('steps back through a name the file DOES define', () => {
    // `..` is reached only after the name before it resolved, so the pair below
    // is what separates the walk from a textual fold.
    const source = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('Node2D', {}, { name: 'Mid', parent: '.' }),
      node('Node2D', {}, { name: 'Other', parent: '.' }),
      node('StaticBody2D', {}, { name: 'Body', parent: 'Other/../Mid' })
    );
    expect(orphansIn(source)).toEqual([]);
    expect(lint(source).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('strands a path stepping back through a name it does not', () => {
    // `get_node_or_null` looks `Other` up among the root's children and returns
    // nullptr on the miss (`node.cpp:1941-1946`), and the `..` arm at `:1919-1924`
    // is never reached, so `Mid` existing rescues nothing. Verified against
    // Godot 4.7.2: the node is re-rooted as `Other____Mid#Body`.
    const orphans = orphansIn(placedUnder('Other/../Mid'));
    expect(orphans.map((d) => d.nodeName)).toEqual(['Body']);
    expect(orphans[0]?.message).toContain('"Other____Mid#Body"');
  });

  it('reads ./ as the root itself', () => {
    const source = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('StaticBody2D', {}, { name: 'Body', parent: './' })
    );
    expect(orphansIn(source)).toEqual([]);
    expect(lint(source).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('spells a folded node the canonical way, so its own children resolve', () => {
    // The reader alone is not enough: `Leaf` placed through `./Mid` has to be
    // registered at `Mid/Leaf`, which is the only spelling a later heading can
    // name it by.
    const source = scene(
      node('Node2D', {}, { name: 'Root' }),
      node('Node2D', {}, { name: 'Mid', parent: '.' }),
      node('Node2D', {}, { name: 'Leaf', parent: './Mid' }),
      node('StaticBody2D', {}, { name: 'Body', parent: 'Mid/Leaf' })
    );
    expect(orphansIn(source)).toEqual([]);
    expect(lint(source).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('still strands a path that steps above the root', () => {
    // `..` on the root returns nullptr (`!current->data.parent`,
    // `node.cpp:1919-1922`), so the node vanishes exactly as a misspelled
    // name does.
    expect(orphansIn(placedUnder('../Mid')).map((d) => d.nodeName)).toEqual(['Body']);
  });

  it('still strands an absolute path', () => {
    // `/root/…` measures from the live SceneTree, and instantiate refuses it
    // outright with `"Can't use get_node() with absolute paths from outside the active scene tree"`
    // (`node.cpp:1898`).
    expect(orphansIn(placedUnder('/root/Mid')).map((d) => d.nodeName)).toEqual(['Body']);
  });

  it('strands a path through a missing name even when an instance sits below it', () => {
    // The anchor twin resolves the same way: `Ghost` is not a child of the
    // root, so `get_node_or_null` returns nullptr there and never reaches the
    // instance the rest of the path names.
    const source = scene(
      node('Node2D', {}, { name: 'Root' }),
      instanced('Player', { parent: '.' }),
      node('Sprite2D', {}, { name: 'Hat', parent: 'Ghost/../Player/Head' })
    );
    expect(orphansIn(source).map((d) => d.nodeName)).toEqual(['Hat']);
  });

  it('still strands a folded path that names nothing', () => {
    expect(orphansIn(placedUnder('./Nope')).map((d) => d.nodeName)).toEqual(['Body']);
  });
});
