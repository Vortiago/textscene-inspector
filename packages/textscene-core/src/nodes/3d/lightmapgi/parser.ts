/** LightmapGI parser: the Node3D parse plus the baked data it applies. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import type { LightmapGIProperties } from './types';

export function parseLightmapGI(
  heading: ParsedHeading,
  properties: Record<string, string>
): LightmapGIProperties {
  return { ...parseNode3D(heading, properties), lightData: properties.light_data };
}
