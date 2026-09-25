/**
 * Window's semantic rule. Format checks live in linterParser.test.ts. Uses `Linter`
 * through testkit, not the `linter/index.ts` barrel: the barrel imports every slice,
 * so a sibling's broken file would fail this test.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Window semantic rules', () => {
  it('reports when max_size is smaller than min_size in some dimension', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(200, 600)' })),
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'info',
        nodeType: 'Window',
        contains: ['max_size', 'min_size'],
      }
    );
  });

  it('reports when max_size is smaller than min_size in both dimensions', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(100, 100)' })),
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'info',
        nodeType: 'Window',
      }
    );
  });

  it('reports nothing when max_size is at or above min_size', () => {
    expectNoDiagnostic(scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(800, 600)' })), {
      ruleName: 'window-max-size-below-min-size',
    });
  });

  it('reports nothing when max_size is Vector2i(0, 0) (the "no maximum" sentinel)', () => {
    expectNoDiagnostic(scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(0, 0)' })), {
      ruleName: 'window-max-size-below-min-size',
    });
  });

  it('stays quiet when only one of min_size/max_size is set', () => {
    expectClean(scene(node('Window', { min_size: 'Vector2i(400, 300)' })));
    expectClean(scene(node('Window', { max_size: 'Vector2i(800, 600)' })));
  });
});

/**
 * Phase 2 runs after a phase-1 error (`linter/Linter.ts:32`), so this rule sees a
 * component no int32 holds. `Vector2` holds doubles: `4294967295` narrows to the UB
 * sentinel, not the -1 that `Vector2i` wraps the same digits to. Measured on 4.6.3.
 */
describe('Window sizes with a converted component no int32 holds', () => {
  it('says nothing rather than naming a max_size the file does not state', () => {
    expectNoDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2(4294967295, 600)' })),
      { ruleName: 'window-max-size-below-min-size' }
    );
  });

  it('still reports on the canonical spelling of the same digits', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(4294967295, 600)' })),
      { ruleName: 'window-max-size-below-min-size', severity: 'info', contains: ['Vector2i(-1, 600)'] }
    );
  });
});

/**
 * Pins that the "size must be at least 2 pixels" warning (viewport.cpp:3711) is not
 * ported. `Viewport::size` (viewport.h:256) is only set by `p_size.maxi(2)`
 * (viewport.cpp:1120, 1133), and `Window.size = (0, 0)` leaves the viewport at (2, 2),
 * measured on 4.6.3. `size` keeps its error from `size.max(size_limit)` (window.cpp:1190).
 */
// Window's `set_size` (window.cpp:401) stores its own `Window::size` (window.h:126),
// then reaches `_set_size` through `_update_viewport_size` (window.cpp:1352).
describe('Window size below the viewport floor', () => {
  it('reports the negative component once, as the validator error, with no warning beside it', () => {
    const diagnostics = lint(scene(node('Window', { size: 'Vector2i(-3, 400)' })));
    expect(diagnostics.map((d) => [d.ruleName, d.severity])).toEqual([['strict-parser', 'error']]);
    expect(diagnostics[0]?.message).toContain('size');
  });

  it('says nothing about a size Godot silently floors', () => {
    expectClean(scene(node('Window', { size: 'Vector2i(1, 1)' })));
    // Popup resolves Window's validators through the base-walk, so this covers
    // the whole family the retired rule reached.
    expectClean(scene(node('Popup', { size: 'Vector2i(1, 600)' })));
  });
});

/**
 * `_update_window_size` raises `size` to `min_size` and caps it at a valid `max_size`
 * (window.cpp:1190-1196). Every setter of the three runs it, in the order the file lists
 * them, so an earlier cap can stand under a later floor. Values measured on 4.6.3.
 */
describe('Window size clamped by min_size and max_size', () => {
  it('warns that a size below min_size loads as min_size', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(200, 100)', min_size: 'Vector2i(400, 300)' })), {
      ruleName: 'window-size-clamped-by-limits',
      severity: 'warning',
      nodeType: 'Window',
      contains: ['Vector2i(200, 100)', 'Vector2i(400, 300)'],
    });
  });

  it('warns that a size above a valid max_size loads as max_size', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(1000, 800)', max_size: 'Vector2i(800, 600)' })), {
      ruleName: 'window-size-clamped-by-limits',
      severity: 'warning',
      contains: ['Vector2i(1000, 800)', 'Vector2i(800, 600)'],
    });
  });

  it('clamps each axis on its own', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(500, 100)', min_size: 'Vector2i(400, 300)' })), {
      ruleName: 'window-size-clamped-by-limits',
      contains: ['Vector2i(500, 300)'],
    });
  });

  it('caps an axis at a zero max_size component when the other component makes max_size valid', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(500, 500)', max_size: 'Vector2i(0, 600)' })), {
      ruleName: 'window-size-clamped-by-limits',
      contains: ['Vector2i(0, 500)'],
    });
  });

  it('keeps a cap that a later min_size invalidates, then floors the capped size', () => {
    const body = { size: 'Vector2i(500, 500)', max_size: 'Vector2i(300, 300)', min_size: 'Vector2i(400, 400)' };
    expectDiagnostic(scene(node('Window', body)), {
      ruleName: 'window-size-clamped-by-limits',
      contains: ['Vector2i(500, 500)', 'Vector2i(400, 400)'],
    });
  });

  it('says nothing when the same three keys list size last, since the invalid max_size never caps', () => {
    const body = { min_size: 'Vector2i(400, 400)', max_size: 'Vector2i(300, 300)', size: 'Vector2i(500, 500)' };
    expectNoDiagnostic(scene(node('Window', body)), { ruleName: 'window-size-clamped-by-limits' });
  });

  it('says nothing for a size inside the limits or equal to them', () => {
    const inside = { size: 'Vector2i(500, 400)', min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(800, 600)' };
    const onEdge = { size: 'Vector2i(400, 600)', min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(800, 600)' };
    expectNoDiagnostic(scene(node('Window', inside)), { ruleName: 'window-size-clamped-by-limits' });
    expectNoDiagnostic(scene(node('Window', onEdge)), { ruleName: 'window-size-clamped-by-limits' });
  });

  it('says nothing for the Vector2i(0, 0) max_size sentinel', () => {
    expectNoDiagnostic(scene(node('Window', { max_size: 'Vector2i(0, 0)', size: 'Vector2i(500, 500)' })), {
      ruleName: 'window-size-clamped-by-limits',
    });
  });

  it('says nothing when min_size or max_size alters a size the file does not state', () => {
    expectNoDiagnostic(scene(node('Window', { min_size: 'Vector2i(400, 300)' })), {
      ruleName: 'window-size-clamped-by-limits',
    });
  });

  it('leaves a negative component to the validator error when no min_size raises it', () => {
    expectNoDiagnostic(scene(node('Window', { size: 'Vector2i(-3, 50)', min_size: 'Vector2i(0, 0)' })), {
      ruleName: 'window-size-clamped-by-limits',
    });
  });

  it('says nothing about a limit no int32 holds', () => {
    expectNoDiagnostic(
      scene(node('Window', { size: 'Vector2i(10, 10)', min_size: 'Vector2(4294967295, 600)' })),
      { ruleName: 'window-size-clamped-by-limits' }
    );
  });

  it('reaches the whole Window family', () => {
    expectDiagnostic(scene(node('Popup', { size: 'Vector2i(10, 10)', min_size: 'Vector2i(20, 5)' })), {
      ruleName: 'window-size-clamped-by-limits',
      nodeType: 'Popup',
      contains: ['Vector2i(20, 10)'],
    });
  });
});

/**
 * `_update_viewport_size` floors `content_scale_factor` to a whole number of at least 1
 * under CONTENT_SCALE_STRETCH_INTEGER (window.cpp:1240-1247). Every setter of either key
 * runs it, so the file order does not matter. Values measured on 4.6.3.
 */
describe('Window content_scale_factor under integer stretch', () => {
  it('warns that a fractional factor loads floored', () => {
    expectDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: 1.5 })), {
      ruleName: 'window-content-scale-factor-floored',
      severity: 'warning',
      nodeType: 'Window',
      contains: ['1.5', 'loads as 1'],
    });
  });

  it('warns that a factor below 1 loads as 1, whichever key the file lists first', () => {
    expectDiagnostic(scene(node('Window', { content_scale_factor: 0.5, content_scale_stretch: 1 })), {
      ruleName: 'window-content-scale-factor-floored',
      contains: ['0.5', 'loads as 1'],
    });
  });

  it('says nothing under fractional stretch', () => {
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 0, content_scale_factor: 1.5 })), {
      ruleName: 'window-content-scale-factor-floored',
    });
    expectNoDiagnostic(scene(node('Window', { content_scale_factor: 1.5 })), {
      ruleName: 'window-content-scale-factor-floored',
    });
  });

  it('says nothing for a whole factor, or one float storage makes whole', () => {
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: 3 })), {
      ruleName: 'window-content-scale-factor-floored',
    });
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: '2.0000001' })), {
      ruleName: 'window-content-scale-factor-floored',
    });
  });

  it('leaves a factor the setter refuses to the validator error', () => {
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: -2 })), {
      ruleName: 'window-content-scale-factor-floored',
    });
  });

  it('says nothing for nan or inf, which the floor leaves as they are', () => {
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: 'nan' })), {
      ruleName: 'window-content-scale-factor-floored',
    });
    expectNoDiagnostic(scene(node('Window', { content_scale_stretch: 1, content_scale_factor: 'inf' })), {
      ruleName: 'window-content-scale-factor-floored',
    });
  });

  it('reaches the whole Window family', () => {
    expectDiagnostic(scene(node('Popup', { content_scale_stretch: 1, content_scale_factor: 2.7 })), {
      ruleName: 'window-content-scale-factor-floored',
      nodeType: 'Popup',
      contains: ['2.7', 'loads as 2'],
    });
  });
});
