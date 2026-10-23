/** LightmapGI parser: the Node3D parse plus the baked data it applies. */

import type { ParsedHeading } from '../../../parser/utils';
import { ShadowmaskMode } from '../../../godot/scene/lightmapGi';
import { enumOr } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import type { LightmapGIProperties } from './types';

const SHADOWMASK_MODES = Object.values(ShadowmaskMode);

export function parseLightmapGI(
  heading: ParsedHeading,
  properties: Record<string, string>
): LightmapGIProperties {
  return {
    ...parseNode3D(heading, properties),
    lightData: properties.light_data,
    shadowmaskMode: enumOr(
      properties.shadowmask_mode,
      ShadowmaskMode.NONE,
      SHADOWMASK_MODES,
      'LightmapGI.shadowmask_mode'
    ),
  };
}
