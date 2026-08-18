/**
 * Tests for Window's semantic linter rule (strict parser format checks live
 * in linterParser.test.ts and are asserted through validatorRegistry there).
 *
 * Uses `Linter` directly (via testkit), not the `linter/index.ts` barrel: that
 * barrel side-effect-imports every in-flight slice, so pulling it here would
 * fail flakily on a sibling's half-written file mid-wave.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Window semantic rules', () => {
  it('warns when max_size is smaller than min_size in some dimension', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(200, 600)' })),
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'warning',
        nodeType: 'Window',
        contains: ['max_size', 'min_size'],
      }
    );
  });

  it('warns when max_size is smaller than min_size in both dimensions', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(100, 100)' })),
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'warning',
        nodeType: 'Window',
      }
    );
  });

  it('does not warn when max_size is at or above min_size', () => {
    expectNoDiagnostic(scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(800, 600)' })), {
      ruleName: 'window-max-size-below-min-size',
    });
  });

  it('does not warn when max_size is Vector2i(0, 0) (the "no maximum" sentinel)', () => {
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
 * Phase 2 runs after a phase-1 error (`linter/Linter.ts:32` gates on a parsed
 * scene, not an error-free one), so a converted spelling whose component no
 * int32 holds reaches this rule. `Vector2` holds DOUBLES: `4294967295` narrows
 * through `double -> int32` to the UB sentinel, not the -1 the `Vector2i`
 * spelling of the same digits wraps to. Measured on 4.6.3.
 */
describe('Window sizes with a converted component no int32 holds', () => {
  it('says nothing rather than naming a max_size the file does not state', () => {
    expectNoDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2(4294967295, 600)' })),
      { ruleName: 'window-max-size-below-min-size' }
    );
  });

  it('still warns on the canonical spelling of the same digits', () => {
    expectDiagnostic(
      scene(node('Window', { min_size: 'Vector2i(400, 300)', max_size: 'Vector2i(4294967295, 600)' })),
      { ruleName: 'window-max-size-below-min-size', severity: 'warning', contains: ['Vector2i(-1, 600)'] }
    );
  });
});
