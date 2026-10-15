import { describe, expect, it } from 'vitest';
import { renderedDepthFogRange } from './depthFog';

describe('renderedDepthFogRange', () => {
  it('ends at the far plane for an end of 0', () => {
    expect(renderedDepthFogRange({ begin: 10, end: 0 }, 400)).toEqual({ begin: 10, end: 400 });
  });

  it('keeps the begin a millimetre short of the end', () => {
    expect(renderedDepthFogRange({ begin: 20, end: 20 }, 400)).toEqual({ begin: 19.999, end: 20 });
  });

  it('passes an ordered range through', () => {
    expect(renderedDepthFogRange({ begin: 10, end: 100 }, 400)).toEqual({ begin: 10, end: 100 });
  });
});
