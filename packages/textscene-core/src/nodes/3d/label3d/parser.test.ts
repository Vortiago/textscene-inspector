/**
 * Label3D parser tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logger from '../../../logger';
import { parseLabel3D } from './parser';
import { BillboardMode } from './types';
import { heading } from '../../../parser/testing/parserKit';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('Label3D Parser', () => {
  describe('parseLabel3D', () => {
    it('should parse Label3D with minimal properties (just text)', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Hello World"',
      });

      expect(props.text).toBe('Hello World');
      expect(props.pixel_size).toBe(0.005);  // Godot default
      expect(props.billboard).toBe(BillboardMode.BILLBOARD_DISABLED);  // Godot default
      expect(props.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });  // default white
      expect(props.outline_size).toBe(12);  // Godot default
      expect(props.outline_modulate).toEqual({ r: 0, g: 0, b: 0, a: 1 });  // default black
    });

    it('should parse text property with quotes removed', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Hello World"',
      });

      expect(props.text).toBe('Hello World');
    });

    it('should parse empty text', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '""',
      });

      expect(props.text).toBe('');
    });

    it('should parse pixel_size property', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        pixel_size: '0.02',
      });

      expect(props.pixel_size).toBe(0.02);
    });

    it('should parse billboard mode 0 (disabled)', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        billboard: '0',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
    });

    it('should parse billboard mode 1 (enabled)', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        billboard: '1',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_ENABLED);
    });

    it('should parse billboard mode 2 (Y-axis only)', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        billboard: '2',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_FIXED_Y);
    });

    it('should parse modulate color', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        modulate: 'Color(1, 0.5, 0, 1)',
      });

      expect(props.modulate).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    });

    it('should parse outline_size', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        outline_size: '8',
      });

      expect(props.outline_size).toBe(8);
    });

    it('should parse outline_modulate color', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
        outline_modulate: 'Color(0.2, 0.2, 0.2, 1)',
      });

      expect(props.outline_modulate).toEqual({ r: 0.2, g: 0.2, b: 0.2, a: 1 });
    });

    it('should parse all properties together', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Full Test"',
        pixel_size: '0.015',
        billboard: '1',
        modulate: 'Color(1, 1, 0, 0.8)',
        outline_size: '4',
        outline_modulate: 'Color(0, 0, 0, 1)',
      });

      expect(props.text).toBe('Full Test');
      expect(props.pixel_size).toBe(0.015);
      expect(props.billboard).toBe(BillboardMode.BILLBOARD_ENABLED);
      expect(props.modulate).toEqual({ r: 1, g: 1, b: 0, a: 0.8 });
      expect(props.outline_size).toBe(4);
      expect(props.outline_modulate).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('should handle missing text with empty string default', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {});

      expect(props.text).toBe('');
    });

    it('should default to billboard DISABLED when not specified (Godot default)', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        text: '"Test"',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
    });

    it('falls back to the Godot default on garbage (never NaN) and warns', () => {
      const props = parseLabel3D(heading('Label3D', { name: 'Label' }), {
        pixel_size: 'garbage',
        outline_size: 'garbage',
      });
      expect(props.pixel_size).toBe(0.005);
      expect(props.outline_size).toBe(12);
      expect(Number.isNaN(props.pixel_size)).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
