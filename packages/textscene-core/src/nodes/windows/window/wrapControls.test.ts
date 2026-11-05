/**
 * `wrap_controls`: an embedded window grows to hold its Controls (`window.cpp:1629-1632`).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { heading } from '../../../parser/testing/parserKit';
import '../../../r3f/controls/index';
import { parseWindow } from './parser';
import { wrappedWindowSize } from './wrapControls';

const THEME = nativeTheme(1);

function windowNode(type: string, properties: Record<string, string>, children: SolveNode[]): SolveNode {
  const node = {
    name: 'Dialog',
    type,
    children: [],
    properties: parseWindow(heading(type, { name: 'Dialog' }), properties),
  };
  return { ...solveNode(), path: 'Dialog', node: node as unknown as TscnNode, children };
}

/** A Control at (x, y) with a custom minimum size, its own anchors at the top-left. */
function placed(x: number, y: number, minimum: { x: number; y: number }): SolveNode {
  const node = controlNode('Box', 'Control', {
    name: 'Box',
    offsetLeft: x,
    offsetTop: y,
    offsetRight: x,
    offsetBottom: y,
    customMinimumSize: minimum,
  });
  return { ...solveNode(), path: 'Dialog/Box', node };
}

describe('wrappedWindowSize', () => {
  it('grows a wrapping window to its furthest Control corner', () => {
    const window = windowNode('Window', { size: 'Vector2i(100, 100)', wrap_controls: 'true' }, [
      placed(20, 30, { x: 400, y: 280 }),
    ]);
    expect(wrappedWindowSize(window, THEME, null)).toEqual({ x: 420, y: 310 });
  });

  it('keeps the loaded size when it already holds the Controls', () => {
    const window = windowNode('Window', { size: 'Vector2i(500, 400)', wrap_controls: 'true' }, [
      placed(20, 30, { x: 400, y: 280 }),
    ]);
    expect(wrappedWindowSize(window, THEME, null)).toEqual({ x: 500, y: 400 });
  });

  it('ignores the Controls of a window that does not wrap', () => {
    const window = windowNode('Window', { size: 'Vector2i(100, 100)' }, [placed(20, 30, { x: 400, y: 280 })]);
    expect(wrappedWindowSize(window, THEME, null)).toEqual({ x: 100, y: 100 });
  });

  it('wraps a PopupPanel, which wraps by default, around its panel', () => {
    const popup = windowNode('PopupPanel', { size: 'Vector2i(10, 10)' }, [placed(0, 0, { x: 200, y: 100 })]);
    expect(wrappedWindowSize(popup, THEME, null)).toEqual({ x: 208, y: 108 });
  });
});
