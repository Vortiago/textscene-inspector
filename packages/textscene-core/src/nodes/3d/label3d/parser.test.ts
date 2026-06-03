/**
 * Label3D parser tests
 */

import { describe, it, expect } from 'vitest';
import { parseLabel3D } from './parser';
import { BillboardMode } from './types';
import type { ParsedHeading } from '../../../parser/utils';

describe('Label3D Parser', () => {
  describe('parseLabel3D', () => {
    it('should parse Label3D with minimal properties (just text)', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Hello World"',
      });

      expect(props.text).toBe('Hello World');
      expect(props.pixel_size).toBe(0.01);  // default
      expect(props.billboard).toBe(BillboardMode.BILLBOARD_ENABLED);  // default
      expect(props.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });  // default white
      expect(props.outline_size).toBe(0);  // default
      expect(props.outline_modulate).toEqual({ r: 0, g: 0, b: 0, a: 1 });  // default black
    });

    it('should parse text property with quotes removed', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Hello World"',
      });

      expect(props.text).toBe('Hello World');
    });

    it('should parse empty text', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '""',
      });

      expect(props.text).toBe('');
    });

    it('should parse pixel_size property', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        pixel_size: '0.02',
      });

      expect(props.pixel_size).toBe(0.02);
    });

    it('should parse billboard mode 0 (disabled)', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        billboard: '0',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
    });

    it('should parse billboard mode 1 (enabled)', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        billboard: '1',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_ENABLED);
    });

    it('should parse billboard mode 2 (Y-axis only)', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        billboard: '2',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_FIXED_Y);
    });

    it('should parse modulate color', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        modulate: 'Color(1, 0.5, 0, 1)',
      });

      expect(props.modulate).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    });

    it('should parse outline_size', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        outline_size: '8',
      });

      expect(props.outline_size).toBe(8);
    });

    it('should parse outline_modulate color', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
        outline_modulate: 'Color(0.2, 0.2, 0.2, 1)',
      });

      expect(props.outline_modulate).toEqual({ r: 0.2, g: 0.2, b: 0.2, a: 1 });
    });

    it('should parse all properties together', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
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
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {});

      expect(props.text).toBe('');
    });

    it('should default to billboard enabled when not specified', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Label',
          type: 'Label3D',
        },
      };

      const props = parseLabel3D(heading, {
        text: '"Test"',
      });

      expect(props.billboard).toBe(BillboardMode.BILLBOARD_ENABLED);
    });
  });
});
