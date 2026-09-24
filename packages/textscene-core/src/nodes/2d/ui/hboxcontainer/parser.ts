/**
 * HBoxContainer parser: the shared BoxContainer parse (Control plus `alignment`).
 * `nativeSolver.ts` stacks the children, and the Control parser collects
 * `theme_override_constants/separation`.
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
