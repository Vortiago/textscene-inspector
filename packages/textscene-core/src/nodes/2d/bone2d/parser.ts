/**
 * Parses a Bone2D: the Node2D surface, `rest` and the four keys its gizmo reads. The constructor
 * sets every column of `rest` to zero to mark it unset (`skeleton_2d.cpp:496-498`), and a scene
 * stores no key at a default.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D, parseTransform2DColumns } from '../../base/node2d/parser';
import type { Transform2DColumns } from '../../../godot/math/transform2d.js';
import { degToRad } from '../../../godot/math/math.js';
import { warn } from '../../../logger';
import { boolOr, floatOr } from '../../../parser/valueParsers';
import type { Bone2DProperties } from './types';

const DEFAULT_LENGTH = 16;
const UNSET_REST: Transform2DColumns = Object.freeze({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 });

export function parseBone2D(heading: ParsedHeading, properties: Record<string, string>): Bone2DProperties {
  const base = parseNode2D(heading, properties);
  return {
    ...base,
    rest: restOf(properties.rest, base.name),
    auto_calculate_length_and_angle: boolOr(properties.auto_calculate_length_and_angle, true),
    length: floatOr(properties.length, DEFAULT_LENGTH),
    bone_angle: degToRad(floatOr(properties.bone_angle, 0)),
    show_bone_gizmo: boolOr(properties['editor_settings/show_bone_gizmo'], true),
  };
}

function restOf(value: string | undefined, name: string): Transform2DColumns {
  if (value === undefined) return UNSET_REST;
  const rest = parseTransform2DColumns(value);
  if (rest) return rest;
  warn(`Bone2D "${name}": expected a finite Transform2D rest, got "${value}"`);
  return UNSET_REST;
}
