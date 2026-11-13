/** The `CAMERA_ATTRIBUTES` kind passes the table test every kind passes (ADR-0071). */
import { describeKindFromEveryOrigin } from '../reading/everyOrigin.testkit';
import { CAMERA_ATTRIBUTES } from './kind';
import type { CameraAttributes } from './types';

describeKindFromEveryOrigin([
  {
    kind: CAMERA_ATTRIBUTES,
    className: 'CameraAttributesPractical',
    body: 'exposure_multiplier = 2.0',
    expected: 2,
    summarise: (attributes: CameraAttributes) => attributes.exposureMultiplier,
  },
]);
