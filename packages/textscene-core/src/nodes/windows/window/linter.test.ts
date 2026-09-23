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
