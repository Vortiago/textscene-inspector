/**
 * No `viewport-size-too-small` rule: its warning (viewport.cpp) reads `Viewport::size`,
 * which only `_set_size` assigns, after `p_size.maxi(2)` (viewport.cpp:1120), `Window`
 * included (window.cpp:1352). On 4.6.3, `size = Vector2i(1, 1)` loads as (2, 2).
 * `size`'s own validator still reports a non-int32 value.
 */

import { describe, it, expect } from 'vitest';
import { Linter } from '../../../linter/Linter.js';
import '../../../linter/index.js';

const windowScene = (value: string) => `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node2D"]

[node name="W" type="Window" parent="."]
size = ${value}
`;

describe('a sub-2-pixel Window size', () => {
  it('draws no size-too-small diagnostic, because Godot floors the value first', () => {
    const diagnostics = new Linter().lint(windowScene('Vector2i(1, 1)'));
    expect(diagnostics.filter((d) => d.ruleName === 'viewport-size-too-small')).toEqual([]);
    expect(diagnostics.map((d) => d.message).join('\n')).not.toContain('at least 2 pixels');
  });

  it('says nothing about a zero size either', () => {
    const diagnostics = new Linter().lint(windowScene('Vector2i(0, 0)'));
    expect(diagnostics.map((d) => d.message).join('\n')).not.toContain('at least 2 pixels');
  });
});
