import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseVisualInstance3D, parseVisualLayers } from './parser';

const HEADING = heading('VisualInstance3D', { name: 'Visual', parent: '.' });

describe('parseVisualInstance3D', () => {
  it('keeps the Node3D fields', () => {
    expect(parseVisualInstance3D(HEADING, {}).name).toBe('Visual');
  });

  it('reads layers', () => {
    expect(parseVisualInstance3D(HEADING, { layers: '6' }).layers).toBe(6);
  });
});

describe('parseVisualLayers', () => {
  it('reads all 32 bits, past the 20 the editor shows', () => {
    expect(parseVisualLayers({ layers: '4294967295' })).toBe(0xffffffff);
  });

  it("defaults to layer 1, Godot's default", () => {
    expect(parseVisualLayers({})).toBe(1);
  });

  it('takes the default for an unreadable value (error case)', () => {
    expect(parseVisualLayers({ layers: 'all' })).toBe(1);
  });

  it('reads 0, which no mask matches (edge case)', () => {
    expect(parseVisualLayers({ layers: '0' })).toBe(0);
  });
});
