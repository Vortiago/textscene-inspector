/** The headings that make Godot refuse to instantiate a scene. */
import { describe, expect, it } from 'vitest';
import { emptyParentHeadings, refusesToInstantiate, rootDeclaringParent } from './instantiateRefusal';
import type { NodeOrigin, RawNode } from './types';

function origin(name: string, declaredParent: string | undefined, overrides: Partial<RawNode> = {}) {
  const node: RawNode = { name, type: 'Node3D', children: [], rawProperties: {}, ...overrides };
  return { node, line: 1, declaredParent, uniqueId: 0 } satisfies NodeOrigin<RawNode>;
}

describe('refusesToInstantiate', () => {
  it('accepts a root and children that declare their parents', () => {
    expect(refusesToInstantiate([origin('Root', undefined), origin('A', '.'), origin('B', 'A')])).toBe(false);
  });

  it('refuses a root that declares a parent', () => {
    expect(refusesToInstantiate([origin('Root', '.'), origin('A', 'Root')])).toBe(true);
  });

  it('refuses a later heading that declares no parent', () => {
    expect(refusesToInstantiate([origin('Root', undefined), origin('Stray', undefined)])).toBe(true);
  });

  it('refuses a heading that spells parent="" (edge case)', () => {
    expect(refusesToInstantiate([origin('Root', undefined), origin('Blank', '')])).toBe(true);
  });

  it('reads the root heading’s identifier off its node', () => {
    const override = origin('Root', undefined, { overridesExistingNode: true });
    expect(refusesToInstantiate([override, origin('A', '.')])).toBe(true);
  });

  it('accepts a well-formed scene', () => {
    expect(refusesToInstantiate([origin('Root', undefined), origin('A', '.')])).toBe(false);
  });

  it('accepts an empty scene (edge case)', () => {
    expect(refusesToInstantiate([])).toBe(false);
  });
});

describe('rootDeclaringParent', () => {
  it('names heading 0 when it declares a parent', () => {
    const [first] = [origin('Root', '.'), origin('A', '.')];
    expect(rootDeclaringParent([first!, origin('A', '.')])).toBe(first);
  });

  it('names nothing for a parentless heading 0', () => {
    expect(rootDeclaringParent([origin('Root', undefined)])).toBeUndefined();
  });

  it('names a heading 0 that spells parent="" (edge case)', () => {
    const [first] = [origin('Root', '')];
    expect(rootDeclaringParent([first!])).toBe(first);
  });
});

describe('emptyParentHeadings', () => {
  it('names each heading that spells parent=""', () => {
    const blank = origin('Blank', '');
    expect(emptyParentHeadings([origin('Root', undefined), blank, origin('A', '.')])).toEqual([blank]);
  });

  it('names nothing in a well-formed scene', () => {
    expect(emptyParentHeadings([origin('Root', undefined), origin('A', '.')])).toEqual([]);
  });
});
