/**
 * HBoxContainer parser — delegates to the shared BoxContainer base (Control
 * plus `alignment`); the horizontal stacking itself and
 * `theme_override_constants/separation` are handled by the Component + the
 * base Control parser's theme-override collection.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseBoxContainer } from '../shared/boxContainer';
import type { HBoxContainerProperties } from './types';

export function parseHBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): HBoxContainerProperties {
  return parseBoxContainer(heading, properties);
}
