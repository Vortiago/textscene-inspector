/**
 * Parses a VBoxContainer through the shared BoxContainer base (Control plus `alignment`). The
 * Control parser collects `theme_override_constants/separation`, and the layout stacks vertically.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseBoxContainer } from '../shared/boxContainer';
import type { VBoxContainerProperties } from './types';

export function parseVBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): VBoxContainerProperties {
  return parseBoxContainer(heading, properties);
}
