/**
 * The OpenXRCompositionLayer family rule, asserted once for every subclass it reaches.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { Linter } from '../../../../linter/Linter.js';
import { readFixture } from '../../../../linter/testing/fixtureCheck.js';
import { openXRCompositionLayerValidationRule } from './linter.js';
import '../../../../linter/index.js';

const PARENT_RULE = 'openxrcompositionlayer-parent-not-xrorigin3d';
const ORTHONORMAL_RULE = 'openxrcompositionlayer-non-orthonormal-transform';
const HOLE_PUNCH_RULE = 'openxrcompositionlayer-hole-punch-sort-order';

const LEAVES = [
  'OpenXRCompositionLayerQuad',
  'OpenXRCompositionLayerCylinder',
  'OpenXRCompositionLayerEquirect',
] as const;

const FIXTURES: Record<(typeof LEAVES)[number], string> = {
  OpenXRCompositionLayerQuad: 'unit-open-xr-composition-layer-quad.tscn',
  OpenXRCompositionLayerCylinder: 'unit-open-xr-composition-layer-cylinder.tscn',
  OpenXRCompositionLayerEquirect: 'unit-open-xr-composition-layer-equirect.tscn',
};

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>, ruleName: string) {
  return diagnostics.filter((d) => d.ruleName === ruleName);
}

describe('OpenXRCompositionLayer family rule', () => {
  it('registers one rule for the family', () => {
    expect(ruleRegistry.getRules().find((r) => r.meta.name === 'valid-openxrcompositionlayer')).toBe(
      openXRCompositionLayerValidationRule
    );
  });

  describe.each(LEAVES)('%s parent-not-XROrigin3D', (nodeType) => {
    it('accepts a layer parented to XROrigin3D', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="${nodeType}" parent="."]
`;
      expect(ruleDiagnostics(new Linter().lint(content), PARENT_RULE)).toEqual([]);
    });

    it('warns when parented to something else', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Layer" type="${nodeType}" parent="."]
`;
      const found = ruleDiagnostics(new Linter().lint(content), PARENT_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
      expect(found[0]!.message).toContain('Node3D');
    });

    it('warns at the scene root — the cast is unconditional, unlike XRCamera3D', () => {
      const content = `[gd_scene format=3]

[node name="Layer" type="${nodeType}"]
`;
      const found = ruleDiagnostics(new Linter().lint(content), PARENT_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.message).toContain('scene root');
    });

    it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Layer" type="${nodeType}" parent="Rig"]
`;
      expect(ruleDiagnostics(new Linter().lint(content), PARENT_RULE)).toEqual([]);
    });

    it('stays quiet when explicitly hidden', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Layer" type="${nodeType}" parent="."]
visible = false
`;
      expect(ruleDiagnostics(new Linter().lint(content), PARENT_RULE)).toEqual([]);
    });
  });

  describe('non-orthonormal transform', () => {
    it('stays quiet on the identity default (no transform key at all)', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
`;
      expect(ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE)).toEqual([]);
    });

    it('stays quiet on a pure-translation transform', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, -2)
`;
      expect(ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE)).toEqual([]);
    });

    it('warns on a scaled basis', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
transform = Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      const found = ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it.each(['inf', 'nan'])('warns on a %s component, a value Godot writes', (spelling) => {
      // A legal literal (variant_parser.cpp:149-157). The column's
      // length_squared() is inf (or NaN, which no comparison calls 1), so
      // basis.cpp:107 answers false and openxr_composition_layer.cpp:769
      // pushes the warning.
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
transform = Transform3D(${spelling}, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE)).toHaveLength(1);
    });

    it('warns on a sheared basis', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
transform = Transform3D(1, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE)).toHaveLength(1);
    });

    // The gate at openxr_composition_layer.cpp:762 closes before :770, so this
    // warning is not part of it. A guard hoisted to the top of the rule body
    // would silence it and nothing else here would notice.
    it('warns on a hidden layer too, since only the parent check is gated', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
visible = false
transform = Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), ORTHONORMAL_RULE)).toHaveLength(1);
    });
  });

  describe('hole-punch sort order', () => {
    it('stays quiet with hole punch off', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
sort_order = -5
`;
      expect(ruleDiagnostics(new Linter().lint(content), HOLE_PUNCH_RULE)).toEqual([]);
    });

    it('warns when hole punch is on and sort_order stays at its non-negative default', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
enable_hole_punch = true
`;
      const found = ruleDiagnostics(new Linter().lint(content), HOLE_PUNCH_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it('warns on a hidden layer too — :774 is outside the gate as well', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
visible = false
enable_hole_punch = true
`;
      expect(ruleDiagnostics(new Linter().lint(content), HOLE_PUNCH_RULE)).toHaveLength(1);
    });

    it('stays quiet when hole punch is on with a negative sort_order', () => {
      const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Layer" type="OpenXRCompositionLayerQuad" parent="."]
enable_hole_punch = true
sort_order = -1
`;
      expect(ruleDiagnostics(new Linter().lint(content), HOLE_PUNCH_RULE)).toEqual([]);
    });
  });

  describe.each(LEAVES)('%s leaves its own fixture clean', (nodeType) => {
    it('draws no diagnostic from any of this family rule\'s three checks', () => {
      const content = readFixture(FIXTURES[nodeType]);
      const diagnostics = new Linter().lint(content);
      const found = [
        ...ruleDiagnostics(diagnostics, PARENT_RULE),
        ...ruleDiagnostics(diagnostics, ORTHONORMAL_RULE),
        ...ruleDiagnostics(diagnostics, HOLE_PUNCH_RULE),
      ];
      expect(found).toEqual([]);
    });

    // The whole-registry claim: this file pulls the full barrel, so `Linter` carries every other
    // slice's rules too, including the XROrigin3D, XRCamera3D and SubViewport ones the fixture needs.
    // The three-ruleName check above is the one this slice owns.
    it('draws no diagnostic at all, from any registered rule', () => {
      const content = readFixture(FIXTURES[nodeType]);
      expect(new Linter().lint(content)).toEqual([]);
    });
  });
});
