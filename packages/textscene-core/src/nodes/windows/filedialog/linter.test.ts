/**
 * FileDialog's semantic linter rule, through `Linter` and the testkit rather than
 * the `linter/index.ts` barrel, which imports every slice.
 */

import { describe, expect, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('FileDialog semantic rules', () => {
  it('reports when an option_<N>/… index is >= option_count', () => {
    expectDiagnostic(
      scene(
        node('FileDialog', {
          option_count: 1,
          'option_1/name': '"Extra"',
        })
      ),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'error',
        nodeType: 'FileDialog',
        contains: ['1', 'option_count (1)'],
      }
    );
  });

  it('reports when option_count is absent (defaults to 0) and an option_0/… key is present', () => {
    expectDiagnostic(
      scene(
        node('FileDialog', {
          'option_0/name': '"Extra"',
        })
      ),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'error',
        nodeType: 'FileDialog',
      }
    );
  });

  it('leaves a negative option index to the dispatcher, which already refuses it', () => {
    // One refusal, one diagnostic: `_get_property` rejects `index < 0` and
    // `index >= count` in the same line, but only the second needs option_count
    // to state, and the first is phase 1's (linterParser.ts).
    expectNoDiagnostic(
      scene(
        node('FileDialog', {
          option_count: 2,
          'option_-1/name': '"Extra"',
        })
      ),
      { ruleName: 'filedialog-option-index-out-of-range' }
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

describe('FileDialog index spelling in the message', () => {
  // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
  it('names what Godot stores beside a wrapping index past the count', () => {
    const diagnostic = expectDiagnostic(
      scene(node('FileDialog', { option_count: 2, 'option_4294967298/name': '"x"' })),
      { ruleName: 'filedialog-option-index-out-of-range', severity: 'error' }
    );
    expect(diagnostic.message).toContain(
      'index(es) 4294967298 (stored as 2) fall outside option_count (2)'
    );
  });

  it('stays silent on an option inside the count whatever its spelling', () => {
    expectNoDiagnostic(scene(node('FileDialog', { option_count: 2, 'option_+01/name': '"x"' })), {
      ruleName: 'filedialog-option-index-out-of-range',
    });
  });
});

describe('FileDialog index grammar', () => {
  it('errors on a `+`-signed index past option_count', () => {
    // `is_valid_int` skips one leading sign, `+` as readily as `-`
    // (ustring.cpp:4752), so `option_+2/name` resolves to option 2 and
    // `_get_property` drops it for being past the count
    // (property_list_helper.cpp:58).
    expectDiagnostic(
      scene(node('FileDialog', { option_count: 1, 'option_+2/name': '"Quality"' })),
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'error',
        nodeType: 'FileDialog',
        contains: ['2', 'option_count (1)'],
      }
    );
  });
});
