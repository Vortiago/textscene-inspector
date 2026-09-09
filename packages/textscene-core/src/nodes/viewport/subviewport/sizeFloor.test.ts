/**
 * `viewport-size-too-small` is RETIRED, and this is where that stays decided.
 *
 * The rule reported "must be at least 2 pixels on both dimensions to render
 * anything" on every `Window` descendant, grounded as one of Godot's own
 * configuration warnings. It is unreachable in 4.6.3.
 *
 * `Viewport::get_configuration_warnings` (viewport.cpp) tests `Viewport::size`,
 * and the ONLY assignment to that field is in `Viewport::_set_size`, which
 * computes `Size2i new_size = p_size.maxi(2)` first (viewport.cpp:1120) and
 * stores that. `Window` keeps the authored number in its OWN `Window::size`
 * and reaches the viewport field through `_set_size` like everything else
 * (window.cpp:1352), so the value the warning reads is floored before it is
 * ever compared. Measured on 4.6.3: a SubViewport written
 * `size = Vector2i(1, 1)` loads with `size == (2, 2)`.
 *
 * Without this test the rule's absence looks like an obvious gap and the next
 * coverage sweep re-adds it. `size` still carries its ordinary validator, so a
 * value no int32 holds is still reported — by that, not by a second arm.
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
