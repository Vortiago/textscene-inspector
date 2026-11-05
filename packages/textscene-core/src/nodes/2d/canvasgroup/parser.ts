/**
 * CanvasGroup parser: the Node2D properties, and `fit_margin`, `clear_margin` and `use_mipmaps`
 * at Godot's defaults 10, 10 and false.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, nonNegativeOr } from '../../../parser/valueParsers';
import type { CanvasGroupProperties } from './types';

/** The default of both margins (`canvas_group.h:37-38`). */
const DEFAULT_MARGIN = 10;

export function parseCanvasGroup(
  heading: ParsedHeading,
  properties: Record<string, string>
): CanvasGroupProperties {
  return {
    ...parseNode2D(heading, properties),
    // Each setter refuses a negative margin (`canvas_group.cpp:34,47`), so the default holds.
    fit_margin: nonNegativeOr(properties.fit_margin, DEFAULT_MARGIN, 'fit_margin'),
    clear_margin: nonNegativeOr(properties.clear_margin, DEFAULT_MARGIN, 'clear_margin'),
    use_mipmaps: boolOr(properties.use_mipmaps, false, 'use_mipmaps'),
  };
}
