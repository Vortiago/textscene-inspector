/**
 * Tests the DirectionalLight2D rule: a layer window that never matches. Godot tests the canvas
 * layer inclusively (`renderer_viewport.cpp:678-684`) and never swaps an inverted pair, so
 * `min > max` reaches nothing. A directional light ignores the z window, so it has no z rule.
 */

import { describe, it, expect } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, lint, node, scene } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';
import { infosOf } from '../../../linter/testing/tierLists';

describe('DirectionalLight2D linter', () => {
  it('reports an inverted layer window at info', () => {
    expectDiagnostic(scene(node('DirectionalLight2D', { range_layer_min: 2, range_layer_max: 1 })), {
      ruleName: 'directionallight2d-inverted-layer-range',
      severity: 'info',
      contains: ['DirectionalLight2D', 'range_layer_min', 'range_layer_max'],
    });
  });

  it("compares an authored bound against the absent half's default", () => {
    expectDiagnostic(scene(node('DirectionalLight2D', { range_layer_min: 1 })), {
      ruleName: 'directionallight2d-inverted-layer-range',
      severity: 'info',
    });
  });

  it("accepts a single-value window, which is Godot's own default", () => {
    expectNoDiagnostic(scene(node('DirectionalLight2D', { range_layer_min: 3, range_layer_max: 3 })), {
      ruleName: 'directionallight2d-inverted-layer-range',
    });
  });

  it('says nothing about an inverted z window, which a directional light never tests', () => {
    expect(lint(scene(node('DirectionalLight2D', { range_z_min: 5, range_z_max: 4 })))).toEqual([]);
  });

  it('ignores a malformed bound, which the validators already report', () => {
    const diagnostics = lint(scene(node('DirectionalLight2D', { range_layer_min: '"five"' })));
    expect(infosOf(diagnostics)).toEqual([]);
  });
});
