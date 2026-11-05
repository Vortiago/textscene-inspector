/**
 * The contents minimum `wrap_controls` floors a window at (`window.cpp:1839-1853`,
 * `popup.cpp:270-292`), read from the window's solved Controls.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { SolvedControl } from '../../../r3f/controls/native/controlRectSolver';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { windowContentsMinimumSize } from './contentsMinimumSize';

const THEME = nativeTheme(1);

function node(path: string, type: string, children: SolveNode[] = [], properties = {}): SolveNode {
  const name = path.split('/').pop()!;
  return { ...solveNode(), path, node: controlNode(name, type, { name, ...properties }), children };
}

function solved(entries: [string, SolvedControl][]): ReadonlyMap<string, SolvedControl> {
  return new Map(entries);
}

describe('windowContentsMinimumSize', () => {
  it('takes the furthest corner of each child’s position plus its minimum (`window.cpp:1842-1849`)', () => {
    const window = node('Dialog', 'Window', [node('Dialog/A', 'Control'), node('Dialog/B', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([
        ['Dialog/A', { rect: { x: 10, y: 20, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }],
        ['Dialog/B', { rect: { x: 50, y: 0, w: 5, h: 5 }, minSize: { x: 40, y: 80 } }],
      ]),
      THEME
    );
    expect(minimum).toEqual({ x: 110, y: 80 });
  });

  it('truncates the position and minimum to integers, as `Point2i` and `Size2i` do', () => {
    const window = node('Dialog', 'Window', [node('Dialog/A', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([['Dialog/A', { rect: { x: 10.7, y: 0.5, w: 5, h: 5 }, minSize: { x: 20.9, y: 30.2 } }]]),
      THEME
    );
    expect(minimum).toEqual({ x: 30, y: 30 });
  });

  it('counts only the window’s own children, not the Controls it adopted from deeper', () => {
    const window = node('Dialog', 'Window', [node('Dialog/Holder/A', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([['Dialog/Holder/A', { rect: { x: 0, y: 0, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }]]),
      THEME
    );
    expect(minimum).toEqual({ x: 0, y: 0 });
  });

  it('adds the panel’s minimum around a PopupPanel’s largest child (`popup.cpp:270-292`)', () => {
    const popup = node('Popup', 'PopupPanel', [node('Popup/A', 'Control')]);
    const minimum = windowContentsMinimumSize(
      popup,
      solved([['Popup/A', { rect: { x: 4, y: 4, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }]]),
      THEME
    );
    expect(minimum).toEqual({ x: 108, y: 38 });
  });

  it('leaves a `top_level` child out of a PopupPanel’s minimum (`popup.cpp:279-281`)', () => {
    const popup = node('Popup', 'PopupPanel', [node('Popup/A', 'Control', [], { topLevel: true })]);
    const minimum = windowContentsMinimumSize(
      popup,
      solved([['Popup/A', { rect: { x: 4, y: 4, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }]]),
      THEME
    );
    expect(minimum).toEqual({ x: 8, y: 8 });
  });
});
