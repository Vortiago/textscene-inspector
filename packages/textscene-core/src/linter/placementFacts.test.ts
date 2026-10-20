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
  return placementFacts(origins, buildSceneTree(origins.map((o) => o.node)));
}

const names = (origins: readonly NodeOrigin<RawNode>[]) => origins.map((o) => o.node.name);

describe('placementFacts', () => {
  it('reports nothing for a well-formed scene', () => {
    expect(factsOf(['Root'], ['Child', '.'])).toEqual({
      orphanedNodes: [],
      rootWithParent: undefined,
      emptyParentHeadings: [],
      idRecoveries: new Map(),
      idHeadings: [
        { uniqueId: 0, instance: undefined, isPlaced: true },
        { uniqueId: 0, instance: undefined, isPlaced: true },
      ],
    });
  });

  it('marks a stranded heading unplaced in the id headings', () => {
    expect(factsOf(['Root'], ['Orphan', 'Missing']).idHeadings.map((h) => h.isPlaced)).toEqual([true, false]);
  });

  it("follows an orphan's id trail to the heading it names", () => {
    const facts = factsOf(['Root'], ['Mid', '.', { uniqueId: 20 }], ['Orphan', 'Gone', { idTrail: [20] }]);
    const [orphan, recovery] = [...facts.idRecoveries][0]!;
    expect(orphan.node.name).toBe('Orphan');
    expect(recovery).toMatchObject({ kind: 'lands', via: { node: { name: 'Mid' } } });
  });

  it('omits an orphan whose id trail names no heading', () => {
    expect(factsOf(['Root'], ['Orphan', 'Gone', { idTrail: [20] }]).idRecoveries.size).toBe(0);
  });

  it('names a heading whose parent path resolves against nothing', () => {
    expect(names(factsOf(['Root'], ['Orphan', 'Missing']).orphanedNodes)).toEqual(['Orphan']);
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
