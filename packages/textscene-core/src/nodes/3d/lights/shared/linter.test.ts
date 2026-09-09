/**
 * The Light3D family's shared own-scale rule, asserted once for every concrete
 * light type it reaches.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { Linter } from '../../../../linter/Linter.js';
import { light3DScaleValidationRule } from './linter.js';
import '../../../../linter/index.js';

const SCALE_RULE = 'light3d-non-unit-scale';

const LEAVES = ['DirectionalLight3D', 'OmniLight3D', 'SpotLight3D', 'AreaLight3D'] as const;

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>, ruleName: string) {
  return diagnostics.filter((d) => d.ruleName === ruleName);
}

describe('Light3D family scale rule', () => {
  it('registers one rule for the family', () => {
    expect(ruleRegistry.getRules().find((r) => r.meta.name === 'valid-light3d-scale')).toBe(
      light3DScaleValidationRule
    );
  });

  it('reaches every concrete light type by name', () => {
    for (const leaf of LEAVES) {
      expect(ruleRegistry.getRulesForNodeType(leaf)).toContain(light3DScaleValidationRule);
    }
  });

  describe.each(LEAVES)('%s', (nodeType) => {
    it('stays quiet on the identity default (no transform key at all)', () => {
      const content = `[gd_scene format=3]

[node name="Light" type="${nodeType}"]
`;
      expect(ruleDiagnostics(new Linter().lint(content), SCALE_RULE)).toEqual([]);
    });

    it('stays quiet on a rotation-only transform', () => {
      const content = `[gd_scene format=3]

[node name="Light" type="${nodeType}"]
transform = Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 3, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), SCALE_RULE)).toEqual([]);
    });

    it('warns on a uniformly scaled transform', () => {
      const content = `[gd_scene format=3]

[node name="Light" type="${nodeType}"]
transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)
`;
      const found = ruleDiagnostics(new Linter().lint(content), SCALE_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it.each(['inf', '-inf', 'nan'])('warns on a %s component, a value Godot writes', (spelling) => {
      // A legal literal (variant_parser.cpp:149-157), not a malformed one:
      // get_scale carries it (or the 0 its NaN determinant signs to) into an
      // axis no comparison calls 1, and light_3d.cpp:183 pushes the warning.
      const content = `[gd_scene format=3]

[node name="Light" type="${nodeType}"]
transform = Transform3D(${spelling}, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), SCALE_RULE)).toHaveLength(1);
    });

    it('warns on a non-uniformly scaled transform', () => {
      const content = `[gd_scene format=3]

[node name="Light" type="${nodeType}"]
transform = Transform3D(1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0)
`;
      expect(ruleDiagnostics(new Linter().lint(content), SCALE_RULE)).toHaveLength(1);
    });
  });
});
