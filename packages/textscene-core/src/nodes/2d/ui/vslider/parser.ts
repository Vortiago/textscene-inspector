/**
 * VSlider parser — delegates to the shared Slider base (Control + Range +
 * tick/editable properties). VSlider adds no properties of its own; only the
 * draw axis differs, which is the Component's business.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseSlider } from '../shared/slider';
import type { VSliderProperties } from './types';

export function parseVSlider(
  heading: ParsedHeading,
  properties: Record<string, string>
): VSliderProperties {
  return parseSlider(heading, properties);
}
