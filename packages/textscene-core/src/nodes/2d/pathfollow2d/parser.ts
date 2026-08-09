/**
 * PathFollow2D parser — the Node2D surface plus the follow controls. The
 * booleans default to Godot's true.
 *
 * `progress` and `progress_ratio` stay optional (undefined when unset) so an
 * unparseable value is reported rather than silently read as 0. Nothing
 * positions from `progress_ratio` — the component samples `progress` alone,
 * because Godot binds the parent Path2D on enter-tree, after a node's
 * properties are applied — but it is still read so a bad value is diagnosed
 * instead of skipped for being unusable anyway.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { floatOr, boolOr } from '../../../parser/valueParsers';
import type { PathFollow2DProperties } from './types';

export function parsePathFollow2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PathFollow2DProperties {
  const base = parseNode2D(heading, properties);
  const result: PathFollow2DProperties = {
    ...base,
    h_offset: floatOr(properties.h_offset, 0),
    v_offset: floatOr(properties.v_offset, 0),
    rotates: boolOr(properties.rotates, true),
    cubic_interp: boolOr(properties.cubic_interp, true),
    loop: boolOr(properties.loop, true),
  };
  if (properties.progress !== undefined) result.progress = floatOr(properties.progress, 0);
  if (properties.progress_ratio !== undefined) {
    result.progress_ratio = floatOr(properties.progress_ratio, 0);
  }
  return result;
}
