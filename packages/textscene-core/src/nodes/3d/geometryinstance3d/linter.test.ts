/**
 * GeometryInstance3D semantic rules: the three cross-field visibility-range
 * checks, through the full `Linter`. linterParser.test.ts covers the format.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('GeometryInstance3D Linter', () => {
  describe('visibility range end vs begin', () => {
    it('warns when End is non-zero and at or below Begin', () => {
      expectDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 50, visibility_range_end: 10 })),
        {
          ruleName: 'geometryinstance3d-visibility-range-end-before-begin',
          severity: 'warning',
          nodeType: 'GeometryInstance3D',
          contains: ['End distance', 'Begin distance'],
        }
      );
    });

    it('warns when End equals Begin exactly (the <= boundary)', () => {
      expectDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 20, visibility_range_end: 20 })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
    });

    it('does not warn when End is 0 (range check disabled)', () => {
      expectNoDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 50, visibility_range_end: 0 })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
    });

    it('warns when Begin is infinite and End is finite', () => {
      // visual_instance_3d.cpp:512 compares the pair as doubles, and `inf` is a
      // value the float slot holds verbatim, so this node is never visible.
      expectDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 'inf', visibility_range_end: 5 })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
    });

    it('does not warn when either side is nan, which no comparison orders', () => {
      expectNoDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 'nan', visibility_range_end: 5 })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
      expectNoDiagnostic(
        scene(node('GeometryInstance3D', { visibility_range_begin: 5, visibility_range_end: 'nan' })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
    });

    it('does not warn when End is greater than Begin', () => {
      expectClean(scene(node('GeometryInstance3D', { visibility_range_begin: 10, visibility_range_end: 50 })));
    });
  });

  describe('fade transition margins', () => {
    it('warns when fade mode is Self, Begin is non-zero, and Begin Margin is 0', () => {
      expectDiagnostic(
        scene(
          node('GeometryInstance3D', {
            visibility_range_fade_mode: 1,
            visibility_range_begin: 10,
            visibility_range_begin_margin: 0,
          })
        ),
        {
          ruleName: 'geometryinstance3d-visibility-range-begin-fade-without-margin',
          severity: 'warning',
          contains: ['Begin Margin'],
        }
      );
    });

    it('warns when fade mode is Dependencies, End is non-zero, and End Margin is 0', () => {
      expectDiagnostic(
        scene(
          node('GeometryInstance3D', {
            visibility_range_fade_mode: 2,
            visibility_range_begin: 10,
            visibility_range_end: 50,
            visibility_range_end_margin: 0,
          })
        ),
        {
          ruleName: 'geometryinstance3d-visibility-range-end-fade-without-margin',
          severity: 'warning',
          contains: ['End Margin'],
        }
      );
    });

    it('does not warn when fade mode is Disabled, regardless of zero margins', () => {
      expectNoDiagnostic(
        scene(
          node('GeometryInstance3D', {
            visibility_range_fade_mode: 0,
            visibility_range_begin: 10,
            visibility_range_begin_margin: 0,
          })
        ),
        { ruleName: 'geometryinstance3d-visibility-range-begin-fade-without-margin' }
      );
    });

    it('does not warn when margins are non-zero', () => {
      expectClean(
        scene(
          node('GeometryInstance3D', {
            visibility_range_fade_mode: 1,
            visibility_range_begin: 10,
            visibility_range_begin_margin: 2,
            visibility_range_end: 50,
            visibility_range_end_margin: 2,
          })
        )
      );
    });
  });

  describe('edge cases', () => {
    it('produces no diagnostics for a node with no properties (all defaults)', () => {
      expectClean(scene(node('GeometryInstance3D')));
    });

    it('stays silent on a CSG shape, whose warnings chain to Node instead', () => {
      // `CSGShape3D::get_configuration_warnings` starts from
      // `Node::get_configuration_warnings` (csg_shape.cpp:978), so it skips
      // GeometryInstance3D and VisualInstance3D both and Godot's editor shows
      // nothing for an inverted visibility range on a CSGBox3D.
      expectNoDiagnostic(
        scene(node('CSGBox3D', { visibility_range_begin: 20, visibility_range_end: 10 })),
        { ruleName: 'geometryinstance3d-visibility-range-end-before-begin' }
      );
    });
  });
});
