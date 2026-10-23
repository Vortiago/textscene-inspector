/**
 * RibbonTrailMesh decode. Defaults: `primitive_meshes.h:477-482`. `set_sections`
 * (`primitive_meshes.cpp:2814`) and `set_section_segments` (:2837) ERR_FAIL outside 2 to 128 and
 * 1 to 1024, keeping the default. `set_shape` (:2788) stores any int, and only Cross builds a cross.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { subResource } from '../../../testing/subResource';
import { decodeRibbonTrailMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const SHRINKING_CURVE = subResource('Curve', 'shrink', {
  _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0.2), 0.0, 0.0, 0, 0]',
});

describe('decodeRibbonTrailMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeRibbonTrailMesh({}, null)).toEqual({
      isCross: true,
      size: 1,
      sections: 5,
      sectionSegments: 3,
      sectionLength: Math.fround(0.2),
      curve: null,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    const p = decodeRibbonTrailMesh(
      {
        shape: '0',
        size: '0.8',
        sections: '7',
        section_segments: '2',
        section_length: '0.5',
        curve: 'SubResource("shrink")',
      },
      SHRINKING_CURVE
    );

    expect(p).toMatchObject({ isCross: false, sections: 7, sectionSegments: 2 });
    expect(p.size).toBeCloseTo(0.8, 6);
    expect(p.sectionLength).toBeCloseTo(0.5, 6);
    expect(p.curve?.points).toHaveLength(2);
  });

  it('builds a cross for shape 1 only, and a flat ribbon for any other int', () => {
    expect(decodeRibbonTrailMesh({ shape: '1' }, null).isCross).toBe(true);
    expect(decodeRibbonTrailMesh({ shape: '0' }, null).isCross).toBe(false);
    expect(decodeRibbonTrailMesh({ shape: '2' }, null).isCross).toBe(false);
    expect(decodeRibbonTrailMesh({ shape: '-1' }, null).isCross).toBe(false);
  });

  it('holds the size and the section length as single-precision floats', () => {
    const p = decodeRibbonTrailMesh({ size: '0.1', section_length: '0.1' }, null);

    expect(p.size).toBe(Math.fround(0.1));
    expect(p.sectionLength).toBe(Math.fround(0.1));
  });

  it('keeps the default size for a value approximately equal to it, as set_size returns early', () => {
    expect(decodeRibbonTrailMesh({ size: '1.000001' }, null).size).toBe(1);
  });

  it('keeps the default sections outside 2 to 128', () => {
    for (const refused of ['1', '129', '0', '-3']) {
      expect(decodeRibbonTrailMesh({ sections: refused }, null).sections).toBe(5);
    }
    expect(decodeRibbonTrailMesh({ sections: '2' }, null).sections).toBe(2);
    expect(decodeRibbonTrailMesh({ sections: '128' }, null).sections).toBe(128);
  });

  it('keeps the default section_segments outside 1 to 1024', () => {
    for (const refused of ['0', '1025', '-1']) {
      expect(decodeRibbonTrailMesh({ section_segments: refused }, null).sectionSegments).toBe(3);
    }
    expect(decodeRibbonTrailMesh({ section_segments: '1' }, null).sectionSegments).toBe(1);
    expect(decodeRibbonTrailMesh({ section_segments: '1024' }, null).sectionSegments).toBe(1024);
  });

  it('reads no curve for no resource, or for one that is not a Curve', () => {
    expect(decodeRibbonTrailMesh({}, null).curve).toBeNull();
    expect(decodeRibbonTrailMesh({}, subResource('Gradient', 'g')).curve).toBeNull();
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const p = decodeRibbonTrailMesh({ size: 'nope', sections: 'nope', shape: 'nope' }, null);

    expect(p.size).toBe(1);
    expect(p.sections).toBe(5);
    expect(p.isCross).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
