/**
 * LightOccluder2D linter: `LightOccluder2D::get_configuration_warnings()`
 * (light_occluder_2d.cpp:265-271). An absent `occluder` polygon is inert.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const RULE_NAME = 'lightoccluder2d-requires-occluder';

describe('LightOccluder2D Linter', () => {
  it('warns when occluder is absent', () => {
    expectDiagnostic(scene(node('LightOccluder2D')), {
      ruleName: RULE_NAME,
      severity: 'warning',
    });
  });

  it('passes when occluder is set', () => {
    expectNoDiagnostic(
      scene(
        '[sub_resource type="OccluderPolygon2D" id="1"]',
        node('LightOccluder2D', { occluder: 'SubResource("1")' })
      ),
      { ruleName: RULE_NAME }
    );
  });

  it('lints every shipped LightOccluder2D fixture clean of this rule', () => {
    for (const fixture of [
      'unit-lightoccluder2d.tscn',
      'unit-lightoccluder2d-cull-mode.tscn',
      'unit-lightoccluder2d-cull-mode-reversed.tscn',
      'unit-lightoccluder2d-shadow.tscn',
      'unit-lightoccluder2d-shadow-closed.tscn',
      'unit-lightoccluder2d-shadow-color.tscn',
      'unit-lightoccluder2d-shadow-mask.tscn',
      'unit-lightoccluder2d-two-lights.tscn',
    ]) {
      const diagnostics = lint(readFixture(fixture)).filter((d) => d.ruleName === RULE_NAME);
      expect(diagnostics, fixture).toEqual([]);
    }
  });
});
