/**
 * PathFollow2D parser — the Node2D surface plus the follow controls. `progress`
 * and `progress_ratio` stay optional (undefined when unset) so the component can
 * tell which one the scene authored; the booleans default to Godot's true.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { floatOr } from '../../../parser/valueParsers';
import type { PathFollow2DProperties } from './types';

function boolOrTrue(value: string | undefined): boolean {
  return value === undefined ? true : value !== 'false';
}

export function parsePathFollow2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PathFollow2DProperties {
  const base = parseNode2D(heading, properties);
  const result: PathFollow2DProperties = {
    ...base,
    h_offset: floatOr(properties.h_offset, 0),
    v_offset: floatOr(properties.v_offset, 0),
    rotates: boolOrTrue(properties.rotates),
    cubic_interp: boolOrTrue(properties.cubic_interp),
    loop: boolOrTrue(properties.loop),
  };
  if (properties.progress !== undefined) result.progress = floatOr(properties.progress, 0);
  if (properties.progress_ratio !== undefined) {
    result.progress_ratio = floatOr(properties.progress_ratio, 0);
  }
  return result;
}
