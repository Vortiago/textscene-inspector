/**
 * Drift guard: a Control painter may not use a bare `<group>`.
 *
 * three decides paint order from `groupOrder` — the `renderOrder` of the
 * NEAREST enclosing `Group` — before the drawn object's own `renderOrder`
 * (`canvasPaintOrder.ts`). A canvas item carries its whole draw-order key on
 * its wrapper group, so a bare `<group>` between that wrapper and a painter's
 * meshes resets the key to 0 for everything inside it and drops those pixels to
 * the very back of the canvas, behind the scene's own background.
 *
 * `<CanvasItemGroup>` carries the ambient key and is the only spelling allowed
 * here. This is a SOURCE check rather than a rendered one on purpose: the
 * defect is invisible to a rendered assertion that reads `mesh.renderOrder`
 * (the half three consults second), and a per-type render harness only covers
 * the painters it can drive with a probe — whereas every painter has source.
 *
 * Found the hard way: every `Label`'s glyphs disappeared behind the backdrop
 * they were drawn over, in eight goldens at once, after the per-line groups
 * `Label` had always used stopped being harmless.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCommentLine,
  isProductionSource,
  reportOffenders,
  walkSources,
  type SourceFile,
} from './testing/sourceScan';

/**
 * Where a slice that draws inside a canvas item can live. Walked RECURSIVELY,
 * because the 2D families nest (`nodes/2d/tiles/*`, `nodes/2d/ui/*`) and a
 * top-level-only scan silently skipped them — as it skipped `r3f/components`,
 * where the shared placeholder every failed resource renders lives.
 */
const SOURCE_ROOTS = ['../nodes/2d', '../nodes/base', '../r3f'].map((dir) =>
  join(import.meta.dirname, dir)
);

/**
 * Every slice that draws inside a canvas item — `Component.tsx` under
 * `nodes/2d/*` (the 2D world) and `nodes/2d/ui/*` (the Control painters). Both
 * halves take the same key on the same wrapper group, so both have the same
 * trap.
 */
function painterSources(): SourceFile[] {
  return walkSources(SOURCE_ROOTS, (name) => name.endsWith('.tsx') && isProductionSource(name));
}

/** Opt-out marker for a group that provably cannot reset a canvas item's key. */
const SAFE_MARKER = 'paint-order-safe:';

/**
 * Lines opening a `<group>` JSX tag that carries no `renderOrder`.
 *
 * The whole opening TAG is examined, not the one line: a group with two props
 * is formatted across several lines, so its `renderOrder` — when it has one —
 * sits below the `<group`. A line-at-a-time check reports every such group as
 * an offender and is useless as a result.
 *
 * Skipped: `<CanvasItemGroup>` and any other element whose name merely starts
 * with `group`; tags inside a comment; and tags whose preamble carries
 * `paint-order-safe:` with a reason — looked for anywhere in the ten lines
 * above the tag rather than in the comment block touching it, since a reason
 * rarely fits on one line and lands above a `return (`, or inside a braced JSX
 * comment, as often as not. The escape hatch exists because a group
 * OUTSIDE a canvas item's wrapper — or one that draws nothing at all — cannot
 * reset anything, and rewriting those into `<CanvasItemGroup>` would claim a
 * relationship to the key they do not have.
 */
function bareGroupLines(source: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    if (!/<group(?![A-Za-z0-9])/.test(lines[i]!)) continue;
    if (lines.slice(Math.max(0, i - 10), i).join('\n').includes(SAFE_MARKER)) continue;

    // The opening tag runs to the first `>` at or after this line.
    let tag = '';
    for (let j = i; j < lines.length; j++) {
      tag += lines[j];
      if (lines[j]!.includes('>')) break;
    }
    if (!/\brenderOrder\b/.test(tag)) offenders.push(i + 1);
  }
  return offenders;
}

describe('Canvas-item paint-group conformance', () => {
  it('uses <CanvasItemGroup>, never a bare <group>, in every slice that draws in a canvas item', () => {
    const offenders = reportOffenders(painterSources(), bareGroupLines);

    expect(
      offenders,
      `these painters would drop their pixels to the back of the canvas — use <CanvasItemGroup>: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would catch a bare <group> — the check is not vacuous', () => {
    expect(bareGroupLines('  <group position={[1, 2, 3]}>')).toEqual([1]);
    expect(bareGroupLines('  <group\n    position={[0, 0, 0]}\n  >')).toEqual([1]);
    expect(bareGroupLines('  <group/>')).toEqual([1]);
    expect(bareGroupLines('  <groupThing />')).toEqual([]);
    // A multi-line group that DOES carry the key is not an offender.
    expect(bareGroupLines('  <group\n    renderOrder={7}\n  >')).toEqual([]);
    expect(bareGroupLines('  <CanvasItemGroup position={[1, 2, 3]}>')).toEqual([]);
    expect(bareGroupLines(' * a `<group>` in a comment is not a use')).toEqual([]);
    expect(bareGroupLines('/** a `<group>` in a one-line doc comment is not a use */')).toEqual([]);
    expect(bareGroupLines('// paint-order-safe: outside any item\n<group />')).toEqual([]);
  });

  it('reads a painter for every slice, so a new one cannot escape unnoticed', () => {
    expect(painterSources().length).toBeGreaterThanOrEqual(60);
  });
});
