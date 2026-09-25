/**
 * `orderViewportPasses`: the topological sort over viewport pass dependencies,
 * asserted on plain `{ id, dependsOn }` records rather than a rendered frame.
 */
import { describe, expect, it } from 'vitest';
import { orderViewportPasses } from './passOrder';

describe('orderViewportPasses', () => {
  it('returns an empty order for an empty graph', () => {
    expect(orderViewportPasses([])).toEqual({ order: [], cycles: [] });
  });

  it('orders a single pass with no dependencies', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: [] }]);
    expect(result.order).toEqual(['a']);
    expect(result.cycles).toEqual([]);
  });

  it('orders a dependency before its dependent', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: [] },
    ]);
    expect(result.order).toEqual(['b', 'a']);
  });

  it('a 3-deep chain orders inner -> outer', () => {
    // Outer samples Middle, and Middle samples Inner, so Inner renders first.
    const result = orderViewportPasses([
      { id: 'Outer', dependsOn: ['Middle'] },
      { id: 'Middle', dependsOn: ['Inner'] },
      { id: 'Inner', dependsOn: [] },
    ]);
    expect(result.order).toEqual(['Inner', 'Middle', 'Outer']);
    expect(result.cycles).toEqual([]);
  });

  it('an unrelated acyclic branch is still ordered correctly alongside a cycle', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['d'] },
      { id: 'd', dependsOn: [] },
    ]);
    expect(result.order.indexOf('d')).toBeLessThan(result.order.indexOf('c'));
    expect(result.cycles).toHaveLength(1);
  });

  it('detects a two-node cycle and reports the offending sampler', () => {
    const result = orderViewportPasses([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(result.cycles).toEqual([{ sampler: 'b', path: ['a', 'b', 'a'] }]);
    // The sort still returns a total order for every pass, cyclic or not.
    expect(result.order).toHaveLength(2);
    expect(new Set(result.order)).toEqual(new Set(['a', 'b']));
  });

  it('detects a self-referencing pass as its own one-node cycle', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: ['a'] }]);
    expect(result.cycles).toEqual([{ sampler: 'a', path: ['a', 'a'] }]);
    expect(result.order).toEqual(['a']);
  });

  it('ignores a dependency on an id the graph does not contain', () => {
    const result = orderViewportPasses([{ id: 'a', dependsOn: ['ghost'] }]);
    expect(result.order).toEqual(['a']);
    expect(result.cycles).toEqual([]);
  });
});
