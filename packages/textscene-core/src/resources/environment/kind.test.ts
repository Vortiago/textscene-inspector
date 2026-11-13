/** The `ENVIRONMENT` kind passes the table test every kind passes (ADR-0071). */
import { describeKindFromEveryOrigin } from '../reading/everyOrigin.testkit';
import { ENVIRONMENT, type DecodedEnvironment } from './kind';

describeKindFromEveryOrigin([
  {
    kind: ENVIRONMENT,
    className: 'Environment',
    body: 'background_mode = 2\nsky = SubResource("sky")\nglow_map = ExtResource("1_map")',
    expected: { backgroundMode: 2, sky: 'SubResource("sky")', glowMap: 'ExtResource("1_map")' },
    summarise: ({ properties, sky, glowMap }: DecodedEnvironment) => ({
      backgroundMode: properties.background_mode,
      sky: sky?.ref,
      glowMap: glowMap?.ref,
    }),
  },
]);
