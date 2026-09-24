/**
 * Tests the NavigationLink2D semantic rule through the testkit `Linter`, not the
 * `linter/index.ts` barrel, which imports every slice and fails on a sibling's
 * broken file.
 */

import { describe, expect, it } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic, lint } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const RULE_NAME = 'navigationlink2d-coincident-endpoints';

describe('NavigationLink2D semantic rules', () => {
  it('warns when start_position and end_position are explicitly the same point', () => {
    expectDiagnostic(
      scene(node('NavigationLink2D', { start_position: 'Vector2(5, 5)', end_position: 'Vector2(5, 5)' })),
      {
        ruleName: RULE_NAME,
        severity: 'warning',
        nodeType: 'NavigationLink2D',
        contains: ['start_position', 'end_position'],
      }
    );
  });

  it('warns when both are explicitly authored at the shared Vector2(0, 0) default', () => {
    expectDiagnostic(
      scene(node('NavigationLink2D', { start_position: 'Vector2(0, 0)', end_position: 'Vector2(0, 0)' })),
      { ruleName: RULE_NAME, severity: 'warning' }
    );
  });

  it('warns on a bare node with neither key written: both resolve to the shared Vector2(0, 0) default, and get_configuration_warnings() compares unconditionally', () => {
    expectDiagnostic(scene(node('NavigationLink2D', {})), { ruleName: RULE_NAME, severity: 'warning' });
  });

  it('warns when only end_position is set to the shared Vector2(0, 0) default, leaving start_position at that same default', () => {
    expectDiagnostic(scene(node('NavigationLink2D', { end_position: 'Vector2(0, 0)' })), {
      ruleName: RULE_NAME,
      severity: 'warning',
    });
  });

  it('does not warn when the two positions differ', () => {
    expectNoDiagnostic(
      scene(node('NavigationLink2D', { start_position: 'Vector2(0, 0)', end_position: 'Vector2(100, 0)' })),
      { ruleName: RULE_NAME }
    );
  });

  it('does not warn when only one position is set away from the shared default', () => {
    expectNoDiagnostic(scene(node('NavigationLink2D', { start_position: 'Vector2(10, 20)' })), {
      ruleName: RULE_NAME,
    });
  });

  it('stays quiet on a malformed value, leaving it to the format validator', () => {
    // linterParser.ts already reports INVALID_START_POSITION_FORMAT for this.
    // The rule must not also fire off a resolved-to-null comparison.
    expectNoDiagnostic(scene(node('NavigationLink2D', { start_position: 'not-a-vector', end_position: 'Vector2(0, 0)' })), {
      ruleName: RULE_NAME,
    });
  });

  it('carries zero diagnostics on the committed fixture, through the real Linter', () => {
    // Stronger than filtering by RULE_NAME: the format validators and this rule
    // together report nothing on the fixture.
    expect(lint(readFixture('unit-navigation-link-2d.tscn'))).toEqual([]);
  });
});
