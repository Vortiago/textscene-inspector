/**
 * Tests for StandardMaterial3D parser
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseColor, parseStandardMaterial3D } from './parser';
import * as logger from '../../../logger';

describe('parseColor', () => {
  it('should parse valid Color format', () => {
    const color = parseColor('Color(1, 0, 0, 1)');

    expect(color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('should parse Color with decimal values', () => {
    const color = parseColor('Color(0.545098, 0.270588, 0.0745098, 1)');

    expect(color).toEqual({
      r: 0.545098,
      g: 0.270588,
      b: 0.0745098,
      a: 1,
    });
  });

  it('should parse Color with spaces', () => {
    const color = parseColor('Color( 1 , 0.5 , 0.25 , 0.75 )');

    expect(color).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.75 });
  });

  it('should parse Color with no spaces', () => {
    const color = parseColor('Color(0.2,0.3,0.4,0.5)');

    expect(color).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 0.5 });
  });

  it('should throw error for invalid Color format', () => {
    expect(() => parseColor('Invalid')).toThrow('Invalid Color format');
  });

  it('should throw error for Color with wrong number of components', () => {
    expect(() => parseColor('Color(1, 0, 0)')).toThrow('Invalid Color format');
  });

  it('should throw error for Color with non-numeric values', () => {
    expect(() => parseColor('Color(a, b, c, d)')).toThrow('Invalid Color format');
  });

  it('should parse black color', () => {
    const color = parseColor('Color(0, 0, 0, 1)');

    expect(color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('should parse white color', () => {
    const color = parseColor('Color(1, 1, 1, 1)');

    expect(color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('should parse transparent color', () => {
    const color = parseColor('Color(1, 1, 1, 0)');

    expect(color).toEqual({ r: 1, g: 1, b: 1, a: 0 });
  });
});

describe('parseStandardMaterial3D', () => {
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('should parse material with albedo_color only', async () => {
    const properties = {
      albedo_color: 'Color(1, 0, 0, 1)',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(result.metallic).toBeUndefined();
    expect(result.roughness).toBeUndefined();
  });

  it('should parse material with all PBR properties', async () => {
    const properties = {
      albedo_color: 'Color(0.5, 0.5, 0.5, 1)',
      metallic: '0.8',
      roughness: '0.3',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
    expect(result.metallic).toBe(0.8);
    expect(result.roughness).toBe(0.3);
  });

  it('should parse material without albedo_color', async () => {
    const properties = {
      metallic: '0.5',
      roughness: '0.7',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toBeUndefined();
    expect(result.metallic).toBe(0.5);
    expect(result.roughness).toBe(0.7);
  });

  it('should parse empty properties', async () => {
    const result = await parseStandardMaterial3D({});

    expect(result).toEqual({});
  });

  it('should handle invalid albedo_color gracefully', async () => {
    const properties = {
      albedo_color: 'Invalid',
      metallic: '0.5',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toBeUndefined();
    expect(result.metallic).toBe(0.5);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse albedo_color')
    );
  });

  it('should handle invalid metallic gracefully', async () => {
    const properties = {
      albedo_color: 'Color(1, 0, 0, 1)',
      metallic: 'not_a_number',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(result.metallic).toBeUndefined();
  });

  it('should handle invalid roughness gracefully', async () => {
    const properties = {
      roughness: 'invalid',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.roughness).toBeUndefined();
  });

  it('should parse brown table material from Hallway scene', async () => {
    const properties = {
      albedo_color: 'Color(0.545098, 0.270588, 0.0745098, 1)',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toEqual({
      r: 0.545098,
      g: 0.270588,
      b: 0.0745098,
      a: 1,
    });
  });

  it('should parse gold material from Hallway scene', async () => {
    const properties = {
      albedo_color: 'Color(1, 0.843137, 0, 1)',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.albedo_color).toEqual({
      r: 1,
      g: 0.843137,
      b: 0,
      a: 1,
    });
  });

  it('should parse metallic and roughness values', async () => {
    const properties = {
      metallic: '0.8',
      roughness: '0.1',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.metallic).toBe(0.8);
    expect(result.roughness).toBe(0.1);
  });

  it('should parse transparency property', async () => {
    const properties = {
      transparency: '1',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.transparency).toBe(1);
  });

  it('should parse zero values correctly', async () => {
    const properties = {
      metallic: '0',
      roughness: '0',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.metallic).toBe(0);
    expect(result.roughness).toBe(0);
  });

  it('should parse values at upper bounds', async () => {
    const properties = {
      metallic: '1',
      roughness: '1',
    };

    const result = await parseStandardMaterial3D(properties);

    expect(result.metallic).toBe(1);
    expect(result.roughness).toBe(1);
  });
});
