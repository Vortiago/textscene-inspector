import { describe, expect, it } from 'vitest';
import { placementFacts } from './placementFacts.js';
import { buildSceneTree } from '../parser/sceneTreeBuilder.js';
import type { NodeOrigin, RawNode } from '../parser/types.js';

function node(name: string, parent?: string): RawNode {
  return {
    name,
    type: 'Node3D',
    rawProperties: {},
    children: [],
    ...(parent !== undefined ? { parent } : {}),
  };
}

/** The `unique_id=` and `parent_id_path=` a heading carries. */
interface HeadingIds {
  uniqueId?: number;
  idTrail?: number[];
}

/** The facts of headings in file order, each declaring `parent=` as given, `''` included. */
function factsOf(...headings: [name: string, declaredParent?: string, ids?: HeadingIds][]) {
  const origins: NodeOrigin<RawNode>[] = headings.map(([name, declaredParent, ids], i) => ({
    node: node(name, declaredParent || undefined),
    line: i + 1,
    declaredParent,
    uniqueId: ids?.uniqueId ?? 0,
    idTrail: ids?.idTrail,
  }));
  return placementFacts(origins, buildSceneTree(origins));
}

const names = (origins: readonly NodeOrigin<RawNode>[]) => origins.map((o) => o.node.name);

describe('placementFacts', () => {
  it('reports nothing for a well-formed scene', () => {
    expect(factsOf(['Root'], ['Child', '.'])).toEqual({
      orphanedNodes: [],
      reRootedNames: new Map(),
      rootWithParent: undefined,
      emptyParentHeadings: [],
      refusesToInstantiate: false,
      idRecoveries: new Map(),
      idHeadings: [
        { uniqueId: 0, instance: undefined, isPlaced: true },
        { uniqueId: 0, instance: undefined, isPlaced: true },
      ],
    });
  });

  it('marks a re-rooted heading placed in the id headings, since Godot builds it', () => {
    expect(factsOf(['Root'], ['Orphan', 'Missing']).idHeadings.map((h) => h.isPlaced)).toEqual([true, true]);
  });

  it('marks a heading unplaced where Godot refuses the scene and re-roots nothing', () => {
    const facts = factsOf(['Root'], ['Orphan', 'Missing'], ['Stray']);
    expect(facts.idHeadings.map((h) => h.isPlaced)).toEqual([true, false, false]);
  });

  it("follows an orphan's id trail to the heading it names", () => {
    const facts = factsOf(['Root'], ['Mid', '.', { uniqueId: 20 }], ['Orphan', 'Gone', { idTrail: [20] }]);
    const [orphan, recovery] = [...facts.idRecoveries][0]!;
    expect(orphan.node.name).toBe('Orphan');
    expect(recovery).toMatchObject({ kind: 'lands', via: { node: { name: 'Mid' } }, viaPath: 'Mid' });
  });

  it('omits an orphan whose id trail names no heading', () => {
    expect(factsOf(['Root'], ['Orphan', 'Gone', { idTrail: [20] }]).idRecoveries.size).toBe(0);
  });

  it('names a re-rooted heading, and the rename the builder gave it', () => {
    const facts = factsOf(['Root'], ['Orphan', 'Missing']);
    expect(names(facts.orphanedNodes)).toEqual(['Orphan']);
    expect([...facts.reRootedNames.values()]).toEqual(['Missing#Orphan']);
  });

  it('names a heading the builder leaves out, for a trail Godot follows', () => {
    const facts = factsOf(['Root'], ['Mid', '.', { uniqueId: 5 }], ['Orphan', 'Missing', { idTrail: [5] }]);
    expect(names(facts.orphanedNodes)).toEqual(['Orphan']);
    expect(facts.reRootedNames.size).toBe(0);
  });

  it('reports a file Godot refuses to instantiate', () => {
    expect(factsOf(['Root'], ['Stray'], ['Orphan', 'Missing']).refusesToInstantiate).toBe(true);
  });

  it('names heading 0 as the root when it declares a parent', () => {
    expect(factsOf(['Node1', 'Missing'], ['Node2', 'Missing']).rootWithParent?.node.name).toBe('Node1');
  });

  it('names heading 0 even when a later heading became the root', () => {
    // The builder prefers a parentless heading wherever it sits, while Godot's root is
    // `i == 0` and nothing else, so only the positional check names the refused heading.
    const facts = factsOf(['A', '.'], ['Root']);
    expect(facts.orphanedNodes).toEqual([]);
    expect(facts.rootWithParent?.node.name).toBe('A');
  });

  it('names every heading that spells parent=""', () => {
    expect(names(factsOf(['Root'], ['A', ''], ['B', '']).emptyParentHeadings)).toEqual(['A', 'B']);
  });

  it('names a root that spells parent="", since the check is positional', () => {
    expect(names(factsOf(['Root', '']).emptyParentHeadings)).toEqual(['Root']);
  });
});
