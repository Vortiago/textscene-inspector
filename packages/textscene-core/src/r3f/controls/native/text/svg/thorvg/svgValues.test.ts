import { describe, expect, it } from 'vitest';
import { lrint, parseTransform, toColour, toLength, toOffset, toOpacity, type ViewGlobal } from './svgValues';

const VIEW: ViewGlobal = { x: 0, y: 0, w: 200, h: 100 };

describe('toLength', () => {
  it('reads a unit anywhere in the text, as ThorVG does', () => {
    expect(toLength(VIEW, '2in', 'Horizontal')).toBe(192);
    expect(toLength(VIEW, '1x-in', 'Horizontal')).toBe(96);
  });

  it('reads a percentage as a share of the view on its axis', () => {
    expect(toLength(VIEW, '50%', 'Horizontal')).toBe(100);
    expect(toLength(VIEW, '50%', 'Vertical')).toBe(50);
    expect(toLength(VIEW, '10%', 'Other')).toBe(20);
  });
});

describe('toOffset', () => {
  it('reads a number or a final percentage, and 0 for anything after it', () => {
    expect(toOffset('0.25')).toBe(0.25);
    expect(toOffset('50%')).toBe(0.5);
    expect(toOffset('50%x')).toBe(0);
    expect(toOffset('0.5px')).toBe(0);
  });
});

describe('toOpacity', () => {
  it('scales a number or a percentage to 255, a tie rounded to even', () => {
    expect(toOpacity('0.5')).toBe(128);
    expect(toOpacity('50%')).toBe(128);
    expect(toOpacity('half')).toBe(255);
    expect(lrint(126.5)).toBe(126);
    expect(lrint(-2.5)).toBe(-2);
  });
});

describe('toColour', () => {
  it('reads the short and long hex forms', () => {
    expect(toColour('#f80', false)).toEqual({ kind: 'colour', colour: { r: 255, g: 136, b: 0 } });
    expect(toColour('#102030', false)).toEqual({ kind: 'colour', colour: { r: 16, g: 32, b: 48 } });
  });

  it('accepts a hex or rgb form that does not read without setting a colour', () => {
    expect(toColour('#12g', false)).toEqual({ kind: 'colour', colour: null });
    expect(toColour('rgb(1,2,x)', false)).toEqual({ kind: 'colour', colour: null });
  });

  it('reads rgb, hsl and named colours', () => {
    expect(toColour('rgb(10,20,30)', false)).toEqual({ kind: 'colour', colour: { r: 10, g: 20, b: 30 } });
    expect(toColour('hsl(120, 100%, 50%)', false)).toEqual({
      kind: 'colour',
      colour: { r: 0, g: 255, b: 0 },
    });
    expect(toColour('MediumPurple', false)).toEqual({
      kind: 'colour',
      colour: { r: 0x93, g: 0x70, b: 0xd8 },
    });
    expect(toColour('notacolour', false)).toEqual({ kind: 'none' });
  });

  it('reads a URL reference only where the reader takes one', () => {
    expect(toColour('url(#paint)', true)).toEqual({ kind: 'url', id: 'paint' });
    expect(toColour('url(#paint)', false)).toEqual({ kind: 'none' });
  });
});

describe('parseTransform', () => {
  it('multiplies a transform list left to right', () => {
    expect(parseTransform('translate(10,20) scale(2)')).toMatchObject({ e11: 2, e13: 10, e22: 2, e23: 20 });
  });

  it('rotates about a point', () => {
    const m = parseTransform('rotate(90 10 10)')!;
    expect(m.e13).toBeCloseTo(20, 5);
    expect(m.e23).toBeCloseTo(0, 5);
    expect(m.e12).toBe(-1);
  });

  it('rejects an unknown function or the wrong count of numbers', () => {
    expect(parseTransform('spin(3)')).toBeNull();
    expect(parseTransform('translate(1,2,3)')).toBeNull();
  });
});
