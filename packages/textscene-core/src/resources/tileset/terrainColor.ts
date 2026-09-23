/**
 * `terrain_set_<n>/terrain_<m>/color`, the one TileSet value its setter rewrites: `set_terrain_color`
 * replaces any alpha but 1.0 with 1.0 (tile_set.cpp:866-869), an ADR-0032 error. Its own file:
 * `godotLiteralGrammar.guard.test.ts` bans the numeric parsers in a file importing
 * `makeFloatTupleRegex`, and the family's index reads next door need one.
 */

import { accepts, makeFloatTupleRegex, propertyError, tupleComponent, v } from '../../linter/validators/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

const COLOR_RE = makeFloatTupleRegex('Color', 4);
const colorFormat = v.color('color');

/**
 * The format check runs first, so a literal that is no Color at all reports as
 * a format error rather than as an alpha that could not be read.
 *
 * `!== 1` rather than a tolerance: the engine's own test is `p_color.a != 1.0`,
 * and a `nan` alpha fails it there and here alike.
 */
export const terrainColor: PropertyValidator = accepts((key, value, line) => {
  const format = colorFormat(key, value, line);
  if (format) return format;
  const match = COLOR_RE.exec(value);
  // A value the format check passed always matches; the guard is for the type.
  if (!match) return null;
  if (tupleComponent(match[4]) === 1) return null;
  return propertyError(
    key,
    line,
    `Property 'color' must have alpha 1: TileSet::set_terrain_color overwrites any other ` +
      `alpha with 1.0 (tile_set.cpp:866), so ${match[4]} is not what the terrain stores`,
    'INVALID_TERRAIN_COLOR_VALUE'
  );
}, 'Color(r, g, b, 1)');
terrainColor.grounding = { kind: 'enforced', cite: 'tile_set.cpp:866' };
