/**
 * Regression contract: the Light3D linter must not be over-strict.
 *
 * The linter wrongly emitted ERROR diagnostics for valid Godot light scenes:
 *  - `light_energy = 0` (a switched-off light, e.g. a headlight that is off)
 *    was rejected as "must be greater than 0".
 *  - an omitted `omni_range` / `spot_range` / `spot_angle` was a hard
 *    "requires X" error, even though Godot supplies a sensible default.
 *
 * All of these are valid and must produce ZERO error-severity diagnostics.
 * This pins the relaxed behavior; the fix relaxes the `light_energy` validator
 * to allow 0 and drops the requires-range / requires-angle semantic rules.
 * (Warnings are not asserted on — only that no ERROR is produced.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import '../../../linter/index.js';

describe('#146 Light3D over-strict regression', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('light_energy = 0 is valid (a switched-off light)', () => {
    const content = `[gd_scene format=3]

[node name="Off" type="OmniLight3D"]
light_energy = 0.0
omni_range = 5.0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('OmniLight3D without omni_range is valid (Godot default applies)', () => {
    const content = `[gd_scene format=3]

[node name="Default" type="OmniLight3D"]
light_energy = 1.0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('SpotLight3D without spot_range or spot_angle is valid (defaults apply)', () => {
    const content = `[gd_scene format=3]

[node name="Default" type="SpotLight3D"]
light_energy = 1.0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('a switched-off spotlight (energy 0, explicit ranges) is valid', () => {
    const content = `[gd_scene format=3]

[node name="HeadlightOff" type="SpotLight3D"]
light_energy = 0.0
spot_range = 30.0
spot_angle = 60.0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toHaveLength(0);
  });
});
