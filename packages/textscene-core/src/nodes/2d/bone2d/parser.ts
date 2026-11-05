/**
 * Parses a Bone2D: the Node2D surface plus `rest`. The constructor sets every column of `rest` to
 * zero to mark it unset (`skeleton_2d.cpp:496-498`), and a scene stores no key at that default.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D, parseTransform2DColumns } from '../../base/node2d/parser';
import type { Transform2DColumns } from '../../../godot/math/transform2d.js';
import { warn } from '../../../logger';
import type { Bone2DProperties } from './types';

const UNSET_REST: Transform2DColumns = Object.freeze({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 });

export function parseBone2D(heading: ParsedHeading, properties: Record<string, string>): Bone2DProperties {
  const base = parseNode2D(heading, properties);
  return { ...base, rest: restOf(properties.rest, base.name) };
}

function restOf(value: string | undefined, name: string): Transform2DColumns {
  if (value === undefined) return UNSET_REST;
  const rest = parseTransform2DColumns(value);
  if (rest) return rest;
  warn(`Bone2D "${name}": expected a finite Transform2D rest, got "${value}"`);
  return UNSET_REST;
}
