/** Parses a VideoStreamPlayer: Control, the stream ref and `expand`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { VideoStreamPlayerProperties } from './types';

export function parseVideoStreamPlayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): VideoStreamPlayerProperties {
  return {
    ...parseControl(heading, properties),
    stream: properties.stream,
    expand: parseOptionalBool(properties.expand) ?? false,
  };
}
