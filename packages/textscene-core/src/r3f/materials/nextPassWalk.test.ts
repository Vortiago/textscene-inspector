/** The walk of a `next_pass` chain: the visited set, and what each pass does. */
import { describe, expect, it } from 'vitest';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { resolveMaterialSource } from './materialSource';
import { NOTHING_DRAWN, nextPassStep, visitedWith } from './nextPassWalk';

function sourceOf(
  reference: string,
  tables: {
    internalResources: readonly TscnInternalResource[];
    externalResources: readonly TscnExternalResource[];
  } = {
    internalResources: [],
    externalResources: [],
  }
) {
  return resolveMaterialSource(reference, tables)!;
}

const MATERIALS: TscnInternalResource[] = [
  { id: 'A', type: 'StandardMaterial3D', data: {} },
  { id: 'B', type: 'StandardMaterial3D', data: {} },
];
const A = sourceOf('SubResource("A")', { internalResources: MATERIALS, externalResources: [] });
const B = sourceOf('SubResource("B")', { internalResources: MATERIALS, externalResources: [] });

describe('nextPassStep', () => {
  it('draws a loaded pass and continues at the pass after it, one position on', () => {
    const step = nextPassStep(
      { source: A, ordinal: 1, visited: NOTHING_DRAWN },
      { readsStencil: false, nextSource: B }
    );

    expect(step.fate).toBe('drawn');
    expect(step.next).toEqual({ source: B, ordinal: 2, visited: visitedWith(NOTHING_DRAWN, A) });
  });

  it('draws the last pass of a chain and stops', () => {
    const step = nextPassStep(
      { source: A, ordinal: 3, visited: NOTHING_DRAWN },
      { readsStencil: false, nextSource: undefined }
    );

    expect(step).toEqual({ fate: 'drawn', next: null });
  });

  it('skips a pass that reads the stencil and continues past it, its position left empty', () => {
    const step = nextPassStep(
      { source: A, ordinal: 1, visited: NOTHING_DRAWN },
      { readsStencil: true, nextSource: B }
    );

    expect(step.fate).toBe('skipped');
    expect(step.next?.ordinal).toBe(2);
  });

  it('ends at a pass whose material already drew, so a cycle draws each material once', () => {
    const step = nextPassStep(
      { source: A, ordinal: 2, visited: visitedWith(NOTHING_DRAWN, A) },
      { readsStencil: false, nextSource: B }
    );

    expect(step).toEqual({ fate: 'ends', next: null });
  });

  it('ends at a surface with no material, which starts no chain', () => {
    expect(nextPassStep({ source: undefined, ordinal: 0, visited: NOTHING_DRAWN }, null).fate).toBe('ends');
  });

  it('waits at a pass still loading, and continues nowhere until it lands', () => {
    expect(nextPassStep({ source: A, ordinal: 1, visited: NOTHING_DRAWN }, null)).toEqual({
      fate: 'waits',
      next: null,
    });
  });
});

describe('visitedWith', () => {
  const declared = (reference: string) =>
    sourceOf(reference, {
      internalResources: [{ id: 'A', type: 'StandardMaterial3D', data: {} }],
      externalResources: [],
    });
  const inline = declared('SubResource("A")');

  it('keeps the seed for a starting pass, which decides its own fate on recursion', () => {
    expect(visitedWith(NOTHING_DRAWN, undefined)).toBe(NOTHING_DRAWN);
  });

  it('adds a pass that has not drawn, and never mutates the set it walks with', () => {
    const added = visitedWith(NOTHING_DRAWN, inline);
    expect(added).not.toBe(NOTHING_DRAWN);
    expect(added.has('inline:scene:A')).toBe(true);
    expect(NOTHING_DRAWN.size).toBe(0);
  });

  it('keeps the same set for a pass whose material already drew: the cycle cuts here', () => {
    const once = visitedWith(NOTHING_DRAWN, inline);
    expect(visitedWith(once, inline)).toBe(once);
  });

  it('keys an inline material apart from a file material of the same name', () => {
    const file = sourceOf('ExtResource("A")', {
      internalResources: [],
      externalResources: [{ id: 'A', path: 'res://a.tres', type: 'StandardMaterial3D' }],
    });
    const both = visitedWith(visitedWith(NOTHING_DRAWN, inline), file);
    expect(both.size).toBe(2);
  });
});
