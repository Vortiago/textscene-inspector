/**
 * Tests for color parser utility
 */

import { describe, it, expect } from 'vitest';
import { parseColor, parseColorToHex } from './colorParser';

describe('colorParser', () => {
  describe('parseColor', () => {
    it('should parse valid Color string', () => {
      const result = parseColor('Color(1, 0.5, 0, 1)');
      expect(result).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    });

    it('should parse Color with spaces', () => {
      const result = parseColor('Color( 0.2 , 0.4 , 0.6 , 0.8 )');
      expect(result).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 0.8 });
    });

    it('should parse white color', () => {
      const result = parseColor('Color(1, 1, 1, 1)');
      expect(result).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    });

    it('should parse black color', () => {
      const result = parseColor('Color(0, 0, 0, 1)');
      expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('should return white fallback for invalid format', () => {
      // Changed from throwing to graceful fallback - returns white color
      expect(parseColor('invalid')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
      expect(parseColor('Color(1, 2, 3)')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
      expect(parseColor('Color(a, b, c, d)')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    });

    it('should return white fallback for undefined input', () => {
      expect(parseColor(undefined)).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    });

    it('should parse negative color values', () => {
      const result = parseColor('Color(-0.5, 0.5, 1.5, 1)');
      expect(result).toEqual({ r: -0.5, g: 0.5, b: 1.5, a: 1 });
    });

    it('should parse color values above 1', () => {
      const result = parseColor('Color(2.0, 1.5, 0.5, 1)');
      expect(result).toEqual({ r: 2.0, g: 1.5, b: 0.5, a: 1 });
    });
  });

  describe('parseColorToHex', () => {
    it('should convert white to 0xFFFFFF', () => {
      const result = parseColorToHex('Color(1, 1, 1, 1)');
      expect(result).toBe(0xffffff);
    });

    it('should convert black to 0x000000', () => {
      const result = parseColorToHex('Color(0, 0, 0, 1)');
      expect(result).toBe(0x000000);
    });

    it('should convert red to 0xFF0000', () => {
      const result = parseColorToHex('Color(1, 0, 0, 1)');
      expect(result).toBe(0xff0000);
    });

    it('should convert green to 0x00FF00', () => {
      const result = parseColorToHex('Color(0, 1, 0, 1)');
      expect(result).toBe(0x00ff00);
    });

    it('should convert blue to 0x0000FF', () => {
      const result = parseColorToHex('Color(0, 0, 1, 1)');
      expect(result).toBe(0x0000ff);
    });

    it('should convert orange to 0xFF8000', () => {
      const result = parseColorToHex('Color(1, 0.5, 0, 1)');
      expect(result).toBe(0xff8000);
    });

    it('should handle mid-range values', () => {
      const result = parseColorToHex('Color(0.5, 0.5, 0.5, 1)');
      expect(result).toBe(0x808080); // 0.5 * 255 = 127.5 -> rounds to 128 (0x80)
    });

    it('should ignore alpha channel', () => {
      const result1 = parseColorToHex('Color(1, 0, 0, 1)');
      const result2 = parseColorToHex('Color(1, 0, 0, 0.5)');
      expect(result1).toBe(result2); // Alpha should not affect hex color
    });

    it('should clamp values outside 0-1 range', () => {
      // Values above 1 should be clamped to 1 (0xFF)
      const result1 = parseColorToHex('Color(2.0, 1.5, 0.5, 1)');
      expect(result1).toBe(0xffff80); // (255, 255, 128)

      // Negative values should be clamped to 0
      const result2 = parseColorToHex('Color(-0.5, 0.5, 1.0, 1)');
      expect(result2).toBe(0x0080ff); // (0, 128, 255)
    });

    it('should return white for invalid input', () => {
      expect(parseColorToHex('invalid')).toBe(0xffffff);
      expect(parseColorToHex(undefined)).toBe(0xffffff);
    });
  });
});
