/**
 * Tests for FileDialog's semantic linter rule (strict parser format checks
 * live in linterParser.test.ts and are asserted through validatorRegistry
 * there).
 *
 * Uses `Linter` directly (via testkit), not the `linter/index.ts` barrel: that
 * barrel side-effect-imports every in-flight slice, so pulling it here would
 * fail flakily on a sibling's half-written file mid-wave.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('FileDialog semantic rules', () => {
  it('warns when an option_<N>/… index is >= option_count', () => {
    expectDiagnostic(
      scene(
        node('FileDialog', {
          option_count: 1,
          'option_1/name': '"Extra"',
        })
      ),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'warning',
        nodeType: 'FileDialog',
        contains: ['1', 'option_count (1)'],
      }
    );
  });

  it('warns when option_count is absent (defaults to 0) and an option_0/… key is present', () => {
    expectDiagnostic(
      scene(
        node('FileDialog', {
          'option_0/name': '"Extra"',
        })
      ),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'warning',
        nodeType: 'FileDialog',
      }
    );
  });

  it('warns on a negative option index', () => {
    expectDiagnostic(
      scene(
        node('FileDialog', {
          option_count: 2,
          'option_-1/name': '"Extra"',
        })
      ),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'warning',
        nodeType: 'FileDialog',
      }
    );
  });

  it('does not warn when every option_<N>/… index is within option_count', () => {
    expectNoDiagnostic(
      scene(
        node('FileDialog', {
          option_count: 2,
          'option_0/name': '"First"',
          'option_1/name': '"Second"',
        })
      ),
      { ruleName: 'filedialog-option-index-out-of-range' }
    );
  });

  it('stays clean with option_count set and no option_<N>/… keys at all', () => {
    expectClean(scene(node('FileDialog', { option_count: 0 })));
  });
});
