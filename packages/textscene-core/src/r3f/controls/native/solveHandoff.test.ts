/**
 * The three **solve handoff** forms (GLOSSARY.md, "Solve handoff"): a **share** (one computation
 * both the solver and the painter call), a **rect share** (a share at one size) and a **channel**
 * (a value the solver seals and the painter opens).
 */
import { describe, expect, it } from 'vitest';
import { defineChannel, defineRectShare, defineShare } from './solveHandoff';
import { nativeTheme } from './nativeTheme';
import { controlNode, solveNode } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import type { TscnNode } from '../../../parser/types';

const NODE: TscnNode = controlNode('N', 'Label');

function node(): SolveNode {
  return { ...solveNode(), path: 'N', node: NODE };
}

describe('defineShare', () => {
  it('computes once per (node, theme) and hands both callers the SAME object', () => {
    let calls = 0;
    const share = defineShare(() => ({ shaped: ++calls }));
    const n = node();
    const theme = nativeTheme(1);

    const first = share(n, theme);
    const second = share(n, theme);

    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  it("recomputes for a different theme object — `theme` is not a dependency of `buildSolveTree`'s tree memo (`buildSolveTree.ts:1068-1097`), so a `SolveNode` survives a theme change", () => {
    let calls = 0;
    const share = defineShare(() => ({ shaped: ++calls }));
    const n = node();

    share(n, nativeTheme(1));
    share(n, nativeTheme(2));

    expect(calls).toBe(2);
  });

  it('serves the FIRST theme again after a second one, so alternating scales never thrash', () => {
    let calls = 0;
    const share = defineShare(() => ({ shaped: ++calls }));
    const n = node();
    const one = nativeTheme(1);
    const two = nativeTheme(2);

    const first = share(n, one);
    share(n, two);

    expect(share(n, one)).toBe(first);
    expect(calls).toBe(2);
  });

  it('recomputes for a different node object — `sortableView` mints a fresh one when a child is promoted (`solveTree.ts:336-339`)', () => {
    let calls = 0;
    const share = defineShare(() => ({ shaped: ++calls }));
    const theme = nativeTheme(1);

    share(node(), theme);
    share(node(), theme);

    expect(calls).toBe(2);
  });

  it('memoises a `null` result too — an empty-text shape must not recompute on every render', () => {
    let calls = 0;
    const share = defineShare<null>(() => {
      calls++;
      return null;
    });
    const n = node();
    const theme = nativeTheme(1);

    expect(share(n, theme)).toBeNull();
    expect(share(n, theme)).toBeNull();
    expect(calls).toBe(1);
  });

  it('gives two shares independent memos, so one node can carry several', () => {
    const a = defineShare(() => 'a');
    const b = defineShare(() => 'b');
    const n = node();
    const theme = nativeTheme(1);

    expect(a(n, theme)).toBe('a');
    expect(b(n, theme)).toBe('b');
  });

  it('passes the node and the theme through to the callback', () => {
    const share = defineShare((n, theme) => `${n.path}@${theme.fontSize}`);
    const theme = nativeTheme(1);

    expect(share(node(), theme)).toBe(`N@${theme.fontSize}`);
  });
});

describe('defineRectShare', () => {
  /** A rect share that counts its computes and answers with the size it ran at. */
  function countingShare() {
    const counter = { calls: 0 };
    const share = defineRectShare((_n, size) => ({ size, call: ++counter.calls }));
    return { share, counter };
  }

  it('computes once for the same size twice', () => {
    const { share, counter } = countingShare();
    const n = node();
    const theme = nativeTheme(1);
    const first = share(n, { x: 10, y: 20 }, theme);
    expect(share(n, { x: 10, y: 20 }, theme)).toBe(first);
    expect(counter.calls).toBe(1);
  });

  it('keeps two sizes in turn, as the tentative pass and the final rect ask', () => {
    const { share, counter } = countingShare();
    const n = node();
    const theme = nativeTheme(1);
    share(n, { x: 10, y: 20 }, theme);
    share(n, { x: 30, y: 20 }, theme);
    share(n, { x: 10, y: 20 }, theme);
    share(n, { x: 30, y: 20 }, theme);
    expect(counter.calls).toBe(2);
  });

  it('drops the oldest size when a third arrives', () => {
    const { share, counter } = countingShare();
    const n = node();
    const theme = nativeTheme(1);
    share(n, { x: 1, y: 1 }, theme);
    share(n, { x: 2, y: 1 }, theme);
    share(n, { x: 3, y: 1 }, theme);
    share(n, { x: 2, y: 1 }, theme);
    expect(counter.calls).toBe(3);
    share(n, { x: 1, y: 1 }, theme);
    expect(counter.calls).toBe(4);
  });

  it('keeps a size asked for again over an older one', () => {
    const { share, counter } = countingShare();
    const n = node();
    const theme = nativeTheme(1);
    share(n, { x: 1, y: 1 }, theme);
    share(n, { x: 2, y: 1 }, theme);
    share(n, { x: 1, y: 1 }, theme);
    share(n, { x: 3, y: 1 }, theme);
    share(n, { x: 1, y: 1 }, theme);
    expect(counter.calls).toBe(3);
  });

  it('recomputes for a second theme at the same size', () => {
    const { share, counter } = countingShare();
    const n = node();
    share(n, { x: 1, y: 1 }, nativeTheme(1));
    share(n, { x: 1, y: 1 }, nativeTheme(2));
    expect(counter.calls).toBe(2);
  });

  it('treats an infinite size as a size, as a first pass with no bound asks', () => {
    const { share, counter } = countingShare();
    const n = node();
    const theme = nativeTheme(1);
    share(n, { x: Infinity, y: 5 }, theme);
    share(n, { x: Infinity, y: 5 }, theme);
    expect(counter.calls).toBe(1);
  });

  it('serves an undefined value as a hit', () => {
    let calls = 0;
    const share = defineRectShare(() => {
      calls++;
      return undefined;
    });
    const n = node();
    const theme = nativeTheme(1);
    share(n, { x: 1, y: 1 }, theme);
    share(n, { x: 1, y: 1 }, theme);
    expect(calls).toBe(1);
  });
});

describe('defineChannel', () => {
  it('opens what it sealed, by identity', () => {
    const channel = defineChannel<{ draggerPos: number }>('split');
    const value = { draggerPos: 12 };

    expect(channel.open(channel.seal(value))).toBe(value);
  });

  it('opens `undefined` to `undefined` rather than throwing — the walker passes `solvedEntry?.meta` and degrades a mismatched tree/solved pair instead of crashing (`ControlCanvasWalker.tsx:209-211,338`)', () => {
    const channel = defineChannel<number>('c');

    expect(channel.open(undefined)).toBeUndefined();
    expect(channel.open(null)).toBeUndefined();
  });

  it("refuses another channel's sealed value — provenance is reference equality, not shape", () => {
    const mine = defineChannel<{ draggerPos: number }>('mine');
    const theirs = defineChannel<{ draggerPos: number }>('theirs');

    expect(mine.open(theirs.seal({ draggerPos: 3 }))).toBeUndefined();
  });

  it('refuses a hand-built object of the same shape — which is what a painter test props literal is', () => {
    const channel = defineChannel<{ draggerPos: number }>('split');

    expect(channel.open({ draggerPos: 3 })).toBeUndefined();
    expect(channel.open('draggerPos')).toBeUndefined();
    expect(channel.open(7)).toBeUndefined();
  });

  it('seals a `null`/`undefined` payload without losing it', () => {
    const channel = defineChannel<number | undefined>('c');

    expect(channel.open(channel.seal(undefined))).toBeUndefined();
    expect(channel.open(channel.seal(0))).toBe(0);
  });
});
