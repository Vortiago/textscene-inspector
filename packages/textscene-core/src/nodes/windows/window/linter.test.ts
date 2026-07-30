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
