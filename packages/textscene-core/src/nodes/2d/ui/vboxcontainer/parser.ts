/**
 * VBoxContainer parser — delegates to the shared BoxContainer base (Control
 * plus `alignment`); the vertical stacking itself and
 * `theme_override_constants/separation` are handled by the Component + the
 * base Control parser's theme-override collection.
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
