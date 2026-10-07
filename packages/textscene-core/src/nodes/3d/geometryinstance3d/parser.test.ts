import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
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
});
