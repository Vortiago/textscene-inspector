/** CameraAttributes validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../linter/testing/testkit';
import './index.linter';

function sceneWithAttributes(type: string, properties: string): string {
  return `[gd_scene format=3]

[sub_resource type="${type}" id="Attributes_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

describe('CameraAttributes validators', () => {
  it('warns on a negative exposure multiplier, below the hint floor', () => {
    expectDiagnostic(sceneWithAttributes('CameraAttributesPractical', 'exposure_multiplier = -1.0'), {
      prop: 'exposure_multiplier',
      severity: 'warning',
    });
  });

  it('accepts an exposure multiplier past the slider, which is or_greater', () => {
    expectNoDiagnostic(sceneWithAttributes('CameraAttributesPractical', 'exposure_multiplier = 16.0'), {
      prop: 'exposure_multiplier',
    });
  });

  it('checks the inherited keys on the physical class too', () => {
    expectDiagnostic(sceneWithAttributes('CameraAttributesPhysical', 'exposure_sensitivity = 40000.0'), {
      prop: 'exposure_sensitivity',
      severity: 'warning',
    });
  });

  it('warns on a boolean given a number', () => {
    expectDiagnostic(sceneWithAttributes('CameraAttributesPractical', 'dof_blur_far_enabled = 3'), {
      prop: 'dof_blur_far_enabled',
    });
  });

  it('warns on a blur amount past one', () => {
    expectDiagnostic(sceneWithAttributes('CameraAttributesPractical', 'dof_blur_amount = 2.0'), {
      prop: 'dof_blur_amount',
      severity: 'warning',
    });
  });

  it('warns on an aperture below the f-stop range', () => {
    expectDiagnostic(sceneWithAttributes('CameraAttributesPhysical', 'exposure_aperture = 0.1'), {
      prop: 'exposure_aperture',
      severity: 'warning',
    });
  });

  it('accepts a far plane past the slider, which is or_greater', () => {
    expectNoDiagnostic(sceneWithAttributes('CameraAttributesPhysical', 'frustum_far = 9000.0'), {
      prop: 'frustum_far',
    });
  });

  it('accepts a minimum exposure value past the slider top, which is or_greater', () => {
    expectNoDiagnostic(
      sceneWithAttributes('CameraAttributesPhysical', 'auto_exposure_min_exposure_value = 20.0'),
      {
        prop: 'auto_exposure_min_exposure_value',
      }
    );
  });
});
