/** Sky validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../linter/testing/testkit';
import './index.linter';

function sceneWithSky(skyProperties: string): string {
  return `[gd_scene format=3]

[sub_resource type="Sky" id="Sky_1"]
${skyProperties}

[node name="Root" type="Node3D"]
`;
}

describe('Sky validators', () => {
  it('warns on a process mode past Real-Time, which the setter stores as it is', () => {
    expectDiagnostic(sceneWithSky('process_mode = 4'), { prop: 'process_mode', severity: 'warning' });
  });

  it('errors on a radiance size index the setter refuses', () => {
    expectDiagnostic(sceneWithSky('radiance_size = 7'), { prop: 'radiance_size', severity: 'error' });
  });

  it('accepts every radiance size the table names', () => {
    expectNoDiagnostic(sceneWithSky('radiance_size = 6'), { prop: 'radiance_size' });
  });
});
