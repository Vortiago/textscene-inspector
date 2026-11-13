/**
 * `applyYSortShifts` must move every draw-sequence field of a `SolveNode` and nothing else. The
 * table below names each field's kind, so a field added to `SolveNode` fails the type check until
 * someone decides whether the y-sort has to move it.
 */
import { describe, it, expect } from 'vitest';
import type { PaintRange } from '../../canvasPaintOrder';
import type { YSortShifts } from '../../contexts/ControlYSortContext';
import type { TscnNode } from '../../../parser/types';
import { applyYSortShifts } from './controlYSort';
import type { SolveNode } from './solveTree';

type FieldKind = 'run' | 'runs' | 'sequence' | 'children' | 'identity' | 'other';

const FIELD_KINDS: Record<keyof SolveNode, FieldKind> = {
  path: 'identity',
  node: 'identity',
  children: 'children',
  paintRange: 'run',
  behindRanges: 'runs',
  paintSequence: 'sequence',
  backSequence: 'sequence',
  layerSequence: 'sequence',
  skippedTransform: 'other',
  inheritance: 'other',
  parentVisibleInTree: 'other',
  rtl: 'other',
  locale: 'other',
  styleBoxes: 'other',
  textureSize: 'other',
  textureSlots: 'other',
  hidden: 'other',
  fontOverrides: 'other',
  labelSettings: 'other',
  labelSettingsFont: 'other',
  themeChain: 'other',
  projectFonts: 'other',
  colors: 'other',
  constants: 'other',
  icons: 'other',
  resources: 'other',
};

const SENTINEL = 'unchanged';
const range = (base: number): PaintRange => ({ base, size: 4 });

function solveNodeAt(path: string, base: number): SolveNode {
  const fields: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(FIELD_KINDS)) {
    if (kind === 'run') fields[key] = range(base);
    if (kind === 'runs') fields[key] = [range(base + 1)];
    if (kind === 'sequence') fields[key] = base + 2;
    if (kind === 'children') fields[key] = [];
    if (kind === 'other') fields[key] = SENTINEL;
  }
  return { ...fields, path, node: { name: path } as TscnNode } as unknown as SolveNode;
}

describe('applyYSortShifts', () => {
  const tree = [solveNodeAt('Root/A', 10)];
  const shifts: YSortShifts = new Map([['Root/A', { run: range(30), from: 10 }]]);
  const [moved] = applyYSortShifts(tree, shifts) as SolveNode[];

  it.each(Object.entries(FIELD_KINDS).filter(([, kind]) => kind === 'run'))(
    'moves the run %s by the shift',
    (key) => expect((moved as unknown as Record<string, PaintRange>)[key]).toEqual(range(30))
  );

  it.each(Object.entries(FIELD_KINDS).filter(([, kind]) => kind === 'runs'))(
    'moves every run in %s by the shift',
    (key) => expect((moved as unknown as Record<string, PaintRange[]>)[key]).toEqual([range(31)])
  );

  it.each(Object.entries(FIELD_KINDS).filter(([, kind]) => kind === 'sequence'))(
    'moves the sequence %s by the shift',
    (key) => expect((moved as unknown as Record<string, number>)[key]).toBe(32)
  );

  it.each(Object.entries(FIELD_KINDS).filter(([, kind]) => kind === 'other'))('leaves %s as it was', (key) =>
    expect((moved as unknown as Record<string, unknown>)[key]).toBe(SENTINEL)
  );

  it('returns the same tree when nothing moved', () => {
    expect(applyYSortShifts(tree, new Map())).toBe(tree);
  });
});
