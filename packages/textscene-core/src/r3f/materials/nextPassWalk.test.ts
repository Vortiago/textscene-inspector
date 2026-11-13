/** The walk of a `next_pass` chain: the visited set, and what each pass does. */
import { describe, expect, it } from 'vitest';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { resolveMaterialSource } from './materialSource';
import { NOTHING_DRAWN, loadedPassOf, nextPassStep } from './nextPassWalk';

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
    expect(step.next).toEqual({ source: B, ordinal: 2, visited: new Set(['inline:scene:A']) });
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
      { source: A, ordinal: 2, visited: new Set(['inline:scene:A']) },
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

describe('the visited set of a walk', () => {
  /** The set the pass after `source` walks with, from a pass that walks with `visited`. */
  const after = (source: typeof A | undefined, visited: ReadonlySet<string> = NOTHING_DRAWN) =>
    nextPassStep({ source, ordinal: 0, visited }, { readsStencil: false, nextSource: B }).next?.visited;

  it('adds a pass that has not drawn, and never changes the set it walks with', () => {
    expect(after(A)?.has('inline:scene:A')).toBe(true);
    expect(NOTHING_DRAWN.size).toBe(0);
  });

  it('keys an inline material apart from a file material of the same name', () => {
    const file = sourceOf('ExtResource("A")', {
      internalResources: [],
      externalResources: [{ id: 'A', path: 'res://a.tres', type: 'StandardMaterial3D' }],
    });
    expect(after(file, after(A))?.size).toBe(2);
  });
});

describe('loadedPassOf', () => {
  const material = A.kind === 'inline' ? A.material : null;

  it('reads none while the material or its scalars are not in', () => {
    expect(loadedPassOf(null, { readsStencil: false, nextPass: undefined })).toBeNull();
    expect(loadedPassOf(material, null)).toBeNull();
  });

  it('resolves the pass after it in the tables of the file that wrote the material', () => {
    const loaded = loadedPassOf(material, { readsStencil: true, nextPass: 'SubResource("B")' });
    expect(loaded).toEqual({ readsStencil: true, nextSource: B });
  });
});
