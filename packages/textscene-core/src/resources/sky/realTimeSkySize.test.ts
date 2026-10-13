/**
 * The warning Godot prints when it loads a Real-Time sky whose radiance size is not 256, reported
 * by the node that holds the sky's environment.
 */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../linter/testing/testkit';
import './index.linter';
import '../environment/index.linter';
import '../../nodes/3d/worldenvironment/index.linter';
import '../../nodes/3d/camera3d/index.linter';

const RULE = 'real-time-sky-radiance-size';

/** A scene whose WorldEnvironment holds a Sky with `skyProperties`. */
function sceneWithSky(skyProperties: string, holder = 'WorldEnvironment'): string {
  return `[gd_scene format=3]

[sub_resource type="Sky" id="Sky_1"]
${skyProperties}

[sub_resource type="Environment" id="Env_1"]
background_mode = 2
sky = SubResource("Sky_1")

[node name="Holder" type="${holder}"]
environment = SubResource("Env_1")
`;
}

describe('real-time sky radiance size', () => {
  it('warns on a Real-Time sky at another size, which Godot bakes at 256', () => {
    expectDiagnostic(sceneWithSky('process_mode = 3\nradiance_size = 2'), {
      ruleName: RULE,
      severity: 'warning',
      contains: ['Real-Time', '256'],
    });
  });

  it('warns through a Camera3D environment as well', () => {
    expectDiagnostic(sceneWithSky('process_mode = 3\nradiance_size = 4', 'Camera3D'), {
      ruleName: RULE,
      severity: 'warning',
    });
  });

  it('accepts a Real-Time sky at the default size, 256', () => {
    expectNoDiagnostic(sceneWithSky('process_mode = 3'), { ruleName: RULE });
  });

  it('accepts another size on a sky that is not Real-Time', () => {
    expectNoDiagnostic(sceneWithSky('process_mode = 1\nradiance_size = 2'), { ruleName: RULE });
  });
});
