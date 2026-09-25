/**
 * `painterView`'s runtime contract: the view carries no `modulate` or
 * `selfModulate`, and it is the same object on every call for one property bag,
 * because painters memoise on props identity. A per-call copy breaks the second.
 */
import { describe, expect, it } from 'vitest';

import type { TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import { painterView } from './solveTree';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

function controlNode(properties: Record<string, unknown>): TscnNode {
  return { name: 'C', type: 'Control', children: [], properties };
}

function nodeWith(properties: Record<string, unknown>): SolveNode {
  return { ...solveNode(), path: 'C', node: controlNode(properties) };
}

/** Both consumed fields plus a representative of everything else. */
function fullProps(): Record<string, unknown> {
  return {
    modulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    selfModulate: { r: 0.25, g: 1, b: 1, a: 1 },
    visible: false,
    text: 'hello',
    customMinimumSize: { x: 4, y: 8 },
  };
}

describe('painterView', () => {
  it('carries no `modulate` or `selfModulate` key at all', () => {
    const view = painterView<ControlProperties>(nodeWith(fullProps()));
    expect(Object.keys(view)).not.toContain('modulate');
    expect(Object.keys(view)).not.toContain('selfModulate');
    // An `undefined`-valued key is still a key a helper can destructure.
    expect('modulate' in view).toBe(false);
    expect('selfModulate' in view).toBe(false);
  });

  it('is not the property bag itself', () => {
    const n = nodeWith(fullProps());
    expect(painterView<ControlProperties>(n)).not.toBe(n.node.properties);
  });

  it('leaves the property bag untouched — the walker and solvers read it there', () => {
    const n = nodeWith(fullProps());
    painterView<ControlProperties>(n);
    expect(n.node.properties).toEqual(fullProps());
  });

  it('returns the same object on every call for one node — painters memoize on props identity', () => {
    const n = nodeWith(fullProps());
    expect(painterView<ControlProperties>(n)).toBe(painterView<ControlProperties>(n));
  });

  it('returns the same object for two `SolveNode`s over one property bag', () => {
    const properties = fullProps();
    const a: SolveNode = { ...solveNode(), path: 'A', node: controlNode(properties) };
    const b: SolveNode = { ...solveNode(), path: 'B', node: controlNode(properties) };
    expect(painterView<ControlProperties>(a)).toBe(painterView<ControlProperties>(b));
  });

  it('gives two nodes with their own bags their own views', () => {
    const a = nodeWith({ ...fullProps(), text: 'a' });
    const b = nodeWith({ ...fullProps(), text: 'b' });
    expect(painterView<ControlProperties>(a)).not.toBe(painterView<ControlProperties>(b));
  });

  it('keeps every other property at its exact value', () => {
    const properties = fullProps();
    const view = painterView<ControlProperties>(nodeWith(properties)) as Record<string, unknown>;
    expect(view).toEqual({
      visible: false,
      text: 'hello',
      customMinimumSize: { x: 4, y: 8 },
    });
    // Shallow: a nested value is the same object, never a clone.
    expect(view['customMinimumSize']).toBe(properties['customMinimumSize']);
  });

  it('narrows an empty bag to an empty view rather than failing', () => {
    expect(painterView<ControlProperties>(nodeWith({}))).toEqual({});
  });
});
