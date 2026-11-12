/** The cull mode of an OccluderPolygon2D from its raw property. */

import { describe, expect, it } from 'vitest';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';
import { parseOccluderCullMode } from './cullMode';

describe('parseOccluderCullMode', () => {
  it('defaults to CULL_DISABLED when the property is absent', () => {
    expect(parseOccluderCullMode(undefined)).toBe(OccluderPolygon2DCullMode.DISABLED);
  });

  it('reads the enum ordinals Godot writes', () => {
    expect(parseOccluderCullMode('0')).toBe(OccluderPolygon2DCullMode.DISABLED);
    expect(parseOccluderCullMode('1')).toBe(OccluderPolygon2DCullMode.CLOCKWISE);
    expect(parseOccluderCullMode('2')).toBe(OccluderPolygon2DCullMode.COUNTER_CLOCKWISE);
  });

  it('falls back to CULL_DISABLED for an out-of-range or unreadable value', () => {
    expect(parseOccluderCullMode('3')).toBe(OccluderPolygon2DCullMode.DISABLED);
    expect(parseOccluderCullMode('-1')).toBe(OccluderPolygon2DCullMode.DISABLED);
    expect(parseOccluderCullMode('clockwise')).toBe(OccluderPolygon2DCullMode.DISABLED);
  });
});
