/**
 * Drift guard: a Control painter uses `<CanvasItemGroup>`, never a bare `<group>`.
 * three orders paint by the nearest enclosing `Group`'s `renderOrder` first
 * (`canvasPaintOrder.ts`), so a bare group resets the canvas item's key to 0 and
 * drops its pixels behind the background.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasExemptionWithin,
  isCommentLine,
  isProductionSource,
  reportOffenders,
  tagEnd,
  walkSources,
  type SourceFile,
} from './testing/sourceScan';

/**
 * Where a slice that draws inside a canvas item can live. Walked recursively:
 * the 2D families nest (`nodes/2d/tiles/*`, `nodes/2d/ui/*`), and `r3f/components`
 * holds the shared placeholder every failed resource renders.
 */
const SOURCE_ROOTS = ['../nodes/2d', '../nodes/base', '../r3f'].map((dir) =>
  join(import.meta.dirname, dir)
);

/**
 * Every slice that draws inside a canvas item: `Component.tsx` under `nodes/2d/*`
 * and `nodes/2d/ui/*`. Both take the same key on the same wrapper group.
 */
function painterSources(): SourceFile[] {
  return walkSources(SOURCE_ROOTS, (name) => name.endsWith('.tsx') && isProductionSource(name));
}

/** Opt-out marker for a group that provably cannot reset a canvas item's key. */
const SAFE_MARKER = 'paint-order-safe:';

/**
 * Lines opening a `<group>` JSX tag that carries no `renderOrder`. A source check,
 * since a rendered one reads `mesh.renderOrder`, the half three consults second.
 * The whole tag is read to its own `>` through `tagEnd()`, since a prop may span
 * lines or hold a `>` (`visible={a > b}`).
 */
function bareGroupLines(source: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    // Not `<CanvasItemGroup>`, nor any longer name starting with `group`.
    const start = lines[i]!.search(/<group(?![A-Za-z0-9])/);
    if (start < 0) continue;
    // `paint-order-safe:` with a reason, anywhere in the ten lines above: a group
    // outside a canvas item's wrapper, or one that draws nothing, resets nothing.
    // The reason often lands above a `return (` or in a braced JSX comment.
    if (hasExemptionWithin(lines, i, SAFE_MARKER)) continue;

    let text = '';
    let end = -1;
    for (let j = i; j < lines.length && end < 0; j++) {
      text += (j > i ? '\n' : '') + lines[j];
      end = tagEnd(text, start);
    }
    if (end < 0) continue;
    if (!/\brenderOrder\b/.test(text.slice(start, end))) offenders.push(i + 1);
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
    // A multi-line group that does carry the key is not an offender.
    expect(bareGroupLines('  <group\n    renderOrder={7}\n  >')).toEqual([]);
    // A prop value holding a `>` does not close the tag early.
    expect(
      bareGroupLines('  <group\n    visible={a > b}\n    renderOrder={1}\n  >')
    ).toEqual([]);
    expect(bareGroupLines('  <group\n    visible={a > b}\n  >')).toEqual([1]);
    expect(bareGroupLines('  <CanvasItemGroup position={[1, 2, 3]}>')).toEqual([]);
    expect(bareGroupLines(' * a `<group>` in a comment is not a use')).toEqual([]);
    expect(bareGroupLines('/** a `<group>` in a one-line doc comment is not a use */')).toEqual([]);
    expect(bareGroupLines('// paint-order-safe: outside any item\n<group />')).toEqual([]);
  });

  it('reads a painter for every slice, so a new one cannot escape unnoticed', () => {
    expect(painterSources().length).toBeGreaterThanOrEqual(60);
  });
});
