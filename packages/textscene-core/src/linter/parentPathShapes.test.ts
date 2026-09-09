/**
 * Every shape a `parent=` can take, and where Godot actually puts the node.
 *
 * This is the COMPLETENESS check, and it is a table because the per-shape cases
 * in `Linter.orphanedNodes.test.ts` could never be one: each tests a spelling
 * somebody thought of, so a shape nobody thought of is invisible — which is how
 * an override heading between an instance and the path shipped broken, along
 * with declaration order and `%Name`. Here the axes are named — the spelling,
 * the opacity of the ancestor the path crosses, and the DECLARATION ORDER of
 * what it names — so a missing shape is a visibly absent ROW.
 *
 * Those cases stay: they assert that a PLACED node is reachable by the phase-2
 * rules, which is a different claim from where it was placed, and this file
 * asserts nothing about it. Neither subsumes the other.
 *
 * The `godot` column is measured, not derived: each row was instantiated by
 * `godot --headless` (4.7.2) and the column is where `Body` came out. A `#` in
 * it means the path vanished and Godot re-rooted under that name, so the one
 * column drives both assertions — placement when it resolves, and the exact
 * rename when it does not. Deriving these by hand got four of them wrong.
 */

import { describe, expect, it } from 'vitest';
import { instanced, lint, node, override, packedScene, scene } from './testing/testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import type { TscnNode } from '../parser/types.js';
import './index.js';

const ORPHAN = 'unresolved-parent-path';

/** `Root` plus two children, the fixtures the spelling rows address. */
const MID = [node('Node2D', {}, { name: 'Mid', parent: '.' }), node('Node2D', {}, { name: 'Other', parent: '.' })];
const ROOT = node('Node2D', {}, { name: 'Root' });
const body = (parent: string) => node('Node2D', {}, { name: 'Body', parent });

interface Shape {
  /** Where `Body` lands, from the headless run. `X#Body` means Godot re-rooted it. */
  readonly godot: string;
  readonly source: string;
  /**
   * Why this parser deliberately answers differently. Only ever leniency: a
   * name inside instanced content, which no parse of THIS file can rule out.
   */
  readonly divergence?: string;
  /** Where it lands HERE, on the rows the divergence above moves. */
  readonly ours?: string;
}

const SHAPES: Record<string, Shape> = {
  // Spellings the NodePath constructor folds away, target declared first.
  'Mid': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('Mid')) },
  './Mid': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('./Mid')) },
  'Mid/': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('Mid/')) },
  'Mid//': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('Mid//')) },
  './Mid/.': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('./Mid/.')) },
  'Mid:position': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('Mid:position')) },
  '.': { godot: 'Body', source: scene(ROOT, ...MID, body('.')) },

  // `..`, which is a WALK: it only steps back from a name that resolved.
  'Other/../Mid': { godot: 'Mid/Body', source: scene(ROOT, ...MID, body('Other/../Mid')) },
  'Missing/../Mid': { godot: 'Missing____Mid#Body', source: scene(ROOT, ...MID, body('Missing/../Mid')) },
  '../Mid': { godot: '___Mid#Body', source: scene(ROOT, ...MID, body('../Mid')) },

  // Absolute paths, which instantiate cannot measure off-tree.
  '/root/Mid': { godot: '___root_Mid#Body', source: scene(ROOT, ...MID, body('/root/Mid')) },
  '/': { godot: '_#Body', source: scene(ROOT, ...MID, body('/')) },

  // Declaration order: `NODE_FROM_ID` asks the tree as it stands at this
  // heading (packed_scene.cpp:157-165), so a later name is not there yet.
  'Mid (declared after)': { godot: 'Mid#Body', source: scene(ROOT, body('Mid'), node('Node2D', {}, { name: 'Mid', parent: '.' })) },

  // `%Name` is a jump into the owner's claim table, not a descent.
  '%Player (claimed above)': {
    godot: 'Player/Body',
    source: scene(ROOT, node('Node2D', { unique_name_in_owner: true }, { name: 'Player', parent: '.' }), body('%Player')),
  },
  '%Player (claimed below)': {
    godot: '_Player#Body',
    source: scene(ROOT, body('%Player'), node('Node2D', { unique_name_in_owner: true }, { name: 'Player', parent: '.' })),
  },
  '%Player (unclaimed)': {
    godot: '_Player#Body',
    source: scene(ROOT, node('Node2D', {}, { name: 'Player', parent: '.' }), body('%Player')),
  },

  // Ancestor opacity: whether the file can rule the intermediate name out.
  'Ins/Inner (instance)': { godot: 'Ins/Inner/Body', source: scene(packedScene, ROOT, instanced('Ins', { parent: '.' }), body('Ins/Inner')) },
  'Ins/Nope (instance, absent there)': {
    godot: 'Ins_Nope#Body',
    source: scene(packedScene, ROOT, instanced('Ins', { parent: '.' }), body('Ins/Nope')),
    ours: 'Ins/Nope/Body',
    divergence:
      'Only the base scene says whether it holds `Nope`, and this parser never opens it. ' +
      'Warning here would fire on every legitimate path into instanced content.',
  },
  'Plain/Inner (plain node)': { godot: 'Plain_Inner#Body', source: scene(ROOT, node('Node2D', {}, { name: 'Plain', parent: '.' }), body('Plain/Inner')) },
  'Ins/Inner/Deep (override between)': {
    godot: 'Ins/Inner/Deep/Body',
    source: scene(packedScene, ROOT, instanced('Ins', { parent: '.' }), override('Inner', 0, { parent: 'Ins' }), body('Ins/Inner/Deep')),
  },
  'Inner/Deep (override under an instanced ROOT)': {
    godot: 'Inner/Deep/Body',
    source: scene(packedScene, instanced('Root'), override('Inner', 0, { parent: '.' }), body('Inner/Deep')),
  },
  'Ov/Child (override, no instance anywhere)': { godot: 'Ov_Child#Body', source: scene(ROOT, override('Ov', 0, { parent: '.' }), body('Ov/Child')) },
};

/**
 * Where `Body` sits in the LENIENT tree, spelled the way Godot spells a live
 * path: an `instanceSubPath` is the segments the sub-scene supplies, so it goes
 * back in. Null when the node was stranded and is in no tree at all.
 *
 * The renderer walks this tree, so asserting it is what keeps the table a guard
 * on both surfaces rather than only on the diagnostic.
 */
function livePathOfBody(source: string): string | null {
  let found: string | null = null;
  const walk = (parent: TscnNode, prefix: string): void => {
    for (const child of parent.children) {
      const path = (child.instanceSubPath ? `${prefix}${child.instanceSubPath}/` : prefix) + child.name;
      if (child.name === 'Body') found = path;
      walk(child, `${path}/`);
    }
  };
  for (const root of new TscnParser().parse(source).nodes) walk(root, '');
  return found;
}

describe('every parent= shape, against a headless Godot run', () => {
  for (const [label, { godot, source, divergence, ours }] of Object.entries(SHAPES)) {
    const reRooted = godot.includes('#');

    it(`${label} → ${godot}${divergence ? ' (we are lenient)' : ''}`, () => {
      const orphans = lint(source).filter((d) => d.ruleName === ORPHAN);

      if (reRooted && !divergence) {
        // The rename is the whole claim: it encodes the path Godot could not
        // walk, spelled through `prepend_period` and `validate_node_name`. And
        // a re-rooted node is in NO tree here, which is what makes every rule
        // skip it — assert that too, or the row passes on a node we placed.
        expect(orphans.map((d) => d.nodeName)).toEqual(['Body']);
        expect(orphans[0]?.message).toContain(`"${godot}"`);
        expect(livePathOfBody(source)).toBeNull();
      } else {
        // Resolved — or resolved only because we cannot see inside an instance.
        // The path assertion is what stops this arm passing on a scene that
        // failed to parse at all, which produces no orphan either.
        expect(orphans).toEqual([]);
        expect(livePathOfBody(source)).toBe(ours ?? godot);
      }
    });
  }

  it('covers every axis, so a new spelling is a missing ROW and not a missing test', () => {
    const labels = Object.keys(SHAPES);
    // Containment per axis rather than a count: a count keeps passing while the
    // row it counted is replaced by another of the same kind.
    expect(labels.filter((l) => l.includes('%'))).toHaveLength(3);
    expect(labels.filter((l) => l.includes('override'))).toHaveLength(3);
    expect(labels.filter((l) => l.startsWith('/'))).toHaveLength(2);
    expect(labels.filter((l) => l.includes('..'))).toHaveLength(3);
    expect(Object.values(SHAPES).filter((s) => s.divergence).length).toBe(1);
  });
});
