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

  it('leaves out an absent value, so a reader takes the Godot default', () => {
    const result = parseGeometryInstance3D(HEADING, {});
    expect(result).not.toHaveProperty('transparency');
    expect(result).not.toHaveProperty('castShadow');
  });

  it('drops an unreadable value', () => {
    expect(parseGeometryInstance3D(HEADING, { transparency: 'abc' })).not.toHaveProperty('transparency');
  });
});
