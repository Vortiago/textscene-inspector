/**
 * `orderViewportPasses`: Godot's order of the viewport passes, deepest level first, asserted on
 * plain `{ id, dependsOn, treeOrder }` records rather than a rendered frame.
 */
import { describe, expect, it } from 'vitest';
import { orderViewportPasses } from './passOrder';

describe('orderViewportPasses', () => {
  it('returns an empty order for an empty graph', () => {
    expect(orderViewportPasses([])).toEqual({ order: [], cycles: [] });
  });

  it('orders a single pass with no dependencies', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: [], treeOrder: null }]);
    expect(result.order).toEqual(['a']);
    expect(result.cycles).toEqual([]);
  });

  it('orders a dependency before its dependent', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'], treeOrder: null },
      { id: 'b', dependsOn: [], treeOrder: null },
    ]);
    expect(result.order).toEqual(['b', 'a']);
  });

  it('a 3-deep chain orders inner -> outer', () => {
    // Outer samples Middle, and Middle samples Inner, so Inner renders first.
    const result = orderViewportPasses([
      { id: 'Outer', dependsOn: ['Middle'], treeOrder: null },
      { id: 'Middle', dependsOn: ['Inner'], treeOrder: null },
      { id: 'Inner', dependsOn: [], treeOrder: null },
    ]);
    expect(result.order).toEqual(['Inner', 'Middle', 'Outer']);
    expect(result.cycles).toEqual([]);
  });

  it('an unrelated acyclic branch is still ordered correctly alongside a cycle', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'], treeOrder: null },
      { id: 'b', dependsOn: ['a'], treeOrder: null },
      { id: 'c', dependsOn: ['d'], treeOrder: null },
      { id: 'd', dependsOn: [], treeOrder: null },
    ]);
    expect(result.order.indexOf('d')).toBeLessThan(result.order.indexOf('c'));
    expect(result.cycles).toHaveLength(1);
  });

  it('detects a two-node cycle and reports the offending sampler', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'], treeOrder: null },
      { id: 'b', dependsOn: ['a'], treeOrder: null },
    ]);
    expect(result.cycles).toEqual([{ sampler: 'b', path: ['a', 'b', 'a'] }]);
    // The sort still returns a total order for every pass, cyclic or not.
    expect(result.order).toHaveLength(2);
    expect(new Set(result.order)).toEqual(new Set(['a', 'b']));
  });

  it('detects a self-referencing pass as its own one-node cycle', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: ['a'], treeOrder: null }]);
    expect(result.cycles).toEqual([{ sampler: 'a', path: ['a', 'a'] }]);
    expect(result.order).toEqual(['a']);
  });

  it('ignores a dependency on an id the graph does not contain', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: ['ghost'], treeOrder: null }]);
    expect(result.order).toEqual(['a']);
    expect(result.cycles).toEqual([]);
  });

  it('draws a deeper viewport before a shallower one outside its subtree', () => {
    // A samples B/B1/B2, three levels deep: renderer_viewport.cpp:91-125 draws B2 first.
    const result = orderViewportPasses([
      { id: 'A', dependsOn: [], treeOrder: [0] },
      { id: 'B/B1/B2', dependsOn: [], treeOrder: [2, 0, 0] },
      { id: 'B/B1', dependsOn: ['B/B1/B2'], treeOrder: [2, 0] },
      { id: 'B', dependsOn: ['B/B1'], treeOrder: [2] },
    ]);
    expect(result.order).toEqual(['B/B1/B2', 'B/B1', 'A', 'B']);
  });

  it('draws a deeper viewport before a shallower one earlier in the tree', () => {
    // C/C1/C2 samples D, which comes first in the tree: Godot still draws C2 first.
    const result = orderViewportPasses([
      { id: 'D', dependsOn: [], treeOrder: [3] },
      { id: 'C/C1/C2', dependsOn: [], treeOrder: [4, 0, 0] },
      { id: 'C/C1', dependsOn: ['C/C1/C2'], treeOrder: [4, 0] },
      { id: 'C', dependsOn: ['C/C1'], treeOrder: [4] },
    ]);
    expect(result.order).toEqual(['C/C1/C2', 'C/C1', 'D', 'C']);
  });

  it('draws the viewports of one level in tree order, whatever order they register in', () => {
    const result = orderViewportPasses([
      { id: 'F/F1', dependsOn: [], treeOrder: null },
      { id: 'F', dependsOn: ['F/F1'], treeOrder: [6] },
      { id: 'E/E1', dependsOn: [], treeOrder: null },
      { id: 'E', dependsOn: ['E/E1'], treeOrder: [5] },
    ]);
    expect(result.order).toEqual(['E/E1', 'F/F1', 'E', 'F']);
  });

  it('draws a viewport with no known tree order after the known ones of its level', () => {
    const result = orderViewportPasses([
      { id: 'late', dependsOn: [], treeOrder: null },
      { id: 'b', dependsOn: [], treeOrder: [1] },
      { id: 'a', dependsOn: [], treeOrder: [0] },
    ]);
    expect(result.order).toEqual(['a', 'b', 'late']);
  });

  it('places the nested viewports of one viewport in the order its subtree lists them', () => {
    const result = orderViewportPasses([
      { id: 'P/Y', dependsOn: [], treeOrder: null },
      { id: 'P/X', dependsOn: [], treeOrder: null },
      { id: 'P', dependsOn: ['P/X', 'P/Y'], treeOrder: [0] },
    ]);
    expect(result.order).toEqual(['P/X', 'P/Y', 'P']);
  });

  it('places a nested viewport where the dispatcher placed it, not by its index in the enclosing list', () => {
    // An instanced sub-scene's nodes enter the tree before the instancing scene's own children.
    const result = orderViewportPasses([
      { id: 'P/Own', dependsOn: [], treeOrder: [0, 1, 0] },
      { id: 'P/Sub/V', dependsOn: [], treeOrder: [0, 0, 0] },
      { id: 'P', dependsOn: ['P/Own', 'P/Sub/V'], treeOrder: [0] },
    ]);
    expect(result.order).toEqual(['P/Sub/V', 'P/Own', 'P']);
  });
});
