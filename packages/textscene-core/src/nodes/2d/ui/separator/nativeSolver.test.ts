/**
 * `separatorMinimumSize` — `Separator::get_minimum_size`
 * (`scene/gui/separator.cpp:33-41`, Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { separatorMinimumSize } from './nativeSolver';

function node(name: string, type: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type, children: [], properties: { name, ...props } as ControlProperties },
  };
}

function ctx(scale = 1): SolveContext {
  return {
    theme: nativeTheme(scale),
    measureText: null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('separatorMinimumSize', () => {
  it('HSeparator: width floors at the bare literal 3, height at the theme separation (default_theme.cpp:1068)', () => {
    const fn = separatorMinimumSize('horizontal');
    expect(fn(node('S', 'HSeparator'), ctx())).toEqual({ x: 3, y: 4 });
  });

  it('VSeparator: height floors at the bare literal 3, width at the theme separation', () => {
    const fn = separatorMinimumSize('vertical');
    expect(fn(node('S', 'VSeparator'), ctx())).toEqual({ x: 4, y: 3 });
  });

  it('the `3` is never scaled, unlike `separation`', () => {
    const fn = separatorMinimumSize('horizontal');
    expect(fn(node('S', 'HSeparator'), ctx(2))).toEqual({ x: 3, y: 8 });
  });

  it('a `theme_override_constants/separation` on the node wins verbatim over the theme', () => {
    const fn = separatorMinimumSize('horizontal');
    const n = node('S', 'HSeparator', { themeOverrideConstants: { separation: 13 } });
    expect(fn(n, ctx())).toEqual({ x: 3, y: 13 });
  });
});
