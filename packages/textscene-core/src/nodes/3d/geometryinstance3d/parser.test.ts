import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { NO_VISIBILITY_RANGE, VisibilityRangeFadeMode } from '../../../godot/visibilityRange';
import { parseGeometryInstance3D } from './parser';

const HEADING = heading('GeometryInstance3D', { name: 'Geometry', parent: '.' });

describe('parseGeometryInstance3D', () => {
  it('keeps the Node3D fields', () => {
    expect(parseGeometryInstance3D(HEADING, {}).name).toBe('Geometry');
  });

  it('reads transparency', () => {
    expect(parseGeometryInstance3D(HEADING, { transparency: '0.25' }).transparency).toBe(0.25);
  });

  it('reads cast_shadow', () => {
    expect(parseGeometryInstance3D(HEADING, { cast_shadow: '0' }).castShadow).toBe(0);
  });

  it('defaults transparency to opaque', () => {
    expect(parseGeometryInstance3D(HEADING, {}).transparency).toBe(0);
  });

  it('defaults cast_shadow to ON', () => {
    expect(parseGeometryInstance3D(HEADING, {}).castShadow).toBe(1);
  });

  it('takes the default for an unreadable transparency', () => {
    expect(parseGeometryInstance3D(HEADING, { transparency: 'abc' }).transparency).toBe(0);
  });

  it('takes the default for an unreadable cast_shadow', () => {
    expect(parseGeometryInstance3D(HEADING, { cast_shadow: 'abc' }).castShadow).toBe(1);
  });

  it('reads the visibility range', () => {
    const parsed = parseGeometryInstance3D(HEADING, {
      visibility_range_begin: '10.0',
      visibility_range_begin_margin: '1.0',
      visibility_range_end: '100.0',
      visibility_range_end_margin: '5.0',
      visibility_range_fade_mode: '1',
    });
    expect(parsed.visibilityRange).toEqual({
      begin: 10,
      beginMargin: 1,
      end: 100,
      endMargin: 5,
      fadeMode: VisibilityRangeFadeMode.SELF,
    });
  });

  it('defaults to no visibility range', () => {
    expect(parseGeometryInstance3D(HEADING, {}).visibilityRange).toEqual(NO_VISIBILITY_RANGE);
  });

  it('takes the default for an unreadable visibility range field', () => {
    const parsed = parseGeometryInstance3D(HEADING, {
      visibility_range_end: 'garbage',
      visibility_range_begin: '2',
    });
    expect(parsed.visibilityRange).toEqual({ ...NO_VISIBILITY_RANGE, begin: 2 });
  });

  it('reads custom_aabb', () => {
    const parsed = parseGeometryInstance3D(HEADING, { custom_aabb: 'AABB(-1, 0, -1, 2, 4, 2)' });
    expect(parsed.customAabb).toEqual({ position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 4, z: 2 } });
  });

  it('reads an all-zero custom_aabb as none, as the setter clears it', () => {
    expect(parseGeometryInstance3D(HEADING, { custom_aabb: 'AABB(0, 0, 0, 0, 0, 0)' }).customAabb).toBeNull();
  });

  it('defaults to no custom_aabb', () => {
    expect(parseGeometryInstance3D(HEADING, {}).customAabb).toBeNull();
  });
});
