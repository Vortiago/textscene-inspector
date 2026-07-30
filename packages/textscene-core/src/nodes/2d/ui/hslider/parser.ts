/**
 * HSlider parser — delegates to the shared Slider base (Control + Range +
 * tick/editable properties). HSlider adds no properties of its own; only the
 * draw axis differs, which is the Component's business.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseSlider } from '../shared/slider';
import type { HSliderProperties } from './types';

export function parseHSlider(
  heading: ParsedHeading,
  properties: Record<string, string>
): HSliderProperties {
  return parseSlider(heading, properties);
}
