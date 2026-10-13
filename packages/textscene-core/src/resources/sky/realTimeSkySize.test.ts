/**
 * The warning Godot prints when it loads a Real-Time sky whose radiance size is not 256, reported
 * on the Sky section, whatever holds it.
 */

import { describe, expect, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, lint } from '../../linter/testing/testkit';
import './index.linter';

const RULE = 'real-time-sky-radiance-size';

/** A scene holding only a Sky with `skyProperties`, which no node uses. */
function sceneWithSky(skyProperties: string): string {
  return `[gd_scene format=3]

[sub_resource type="Sky" id="Sky_1"]
${skyProperties}

[node name="Root" type="Node3D"]
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

  it('puts the warning on the process_mode line of the Sky', () => {
    const [diagnostic] = lint(sceneWithSky('radiance_size = 2\nprocess_mode = 3')).filter(
      (d) => d.ruleName === RULE
    );
    expect(diagnostic).toMatchObject({ nodeName: 'Sky_1', nodeType: 'Sky', location: { line: 5 } });
  });

  it('warns on a Sky held in a .tres', () => {
    expectDiagnostic(
      '[gd_resource type="Sky" format=3]\n\n[resource]\nprocess_mode = 3\nradiance_size = 4\n',
      {
        ruleName: RULE,
        severity: 'warning',
      }
    );
  });

  it('accepts a Real-Time sky at the default size, 256', () => {
    expectNoDiagnostic(sceneWithSky('process_mode = 3'), { ruleName: RULE });
  });

  it('accepts another size on a sky that is not Real-Time', () => {
    expectNoDiagnostic(sceneWithSky('process_mode = 1\nradiance_size = 2'), { ruleName: RULE });
  });
});
