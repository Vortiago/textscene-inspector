import { CurveTangentMode } from '../../../godot/scene/curve.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** One `_data` entry: a position plus the two tangents meeting at it. */
export interface CurvePoint {
  position: { x: number; y: number };
  leftTangent: number;
  rightTangent: number;
  leftMode: EnumValue<typeof CurveTangentMode>;
  rightMode: EnumValue<typeof CurveTangentMode>;
}

export interface Curve {
  /** Points in authored order (Godot keeps `_data` sorted by `position.x`). */
  points: CurvePoint[];
  /** `_limits[0]`: the editor's vertical minimum. Not applied by `sampleCurve`. */
  minValue: number;
  /** `_limits[1]`: the editor's vertical maximum. Not applied by `sampleCurve`. */
  maxValue: number;
  /** `_limits[2]`: the horizontal domain start (Godot 4.3+, older files omit it). */
  minDomain: number;
  /** `_limits[3]`: the horizontal domain end (Godot 4.3+, older files omit it). */
  maxDomain: number;
}

/** A `Curve` with no points, for which Godot's `sample()` answers 0. */
export const EMPTY_CURVE: Curve = {
  points: [],
  minValue: 0,
  maxValue: 1,
  minDomain: 0,
  maxDomain: 1,
};
