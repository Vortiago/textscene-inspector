/**
 * TubeTrailMesh decode. Defaults: `primitive_meshes.h:420-428`. `set_radial_steps` (`primitive_meshes.cpp:2402`),
 * `set_sections` (:2414) and `set_section_rings` (:2437) ERR_FAIL outside 3 to 128, 2 to 128 and
 * 1 to 1024, keeping the default.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { subResource } from '../../../testing/subResource';
import { decodeTubeTrailMesh } from './decode';

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

describe('decodeTubeTrailMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeTubeTrailMesh({}, [])).toEqual({
      radius: 0.5,
      radialSteps: 8,
      sections: 5,
      sectionLength: Math.fround(0.2),
      sectionRings: 3,
      capTop: true,
      capBottom: true,
      curve: null,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    const p = decodeTubeTrailMesh(
      {
        radius: '0.8',
        radial_steps: '12',
        sections: '7',
        section_length: '0.5',
        section_rings: '2',
        cap_top: 'false',
        cap_bottom: 'false',
        curve: 'SubResource("shrink")',
      },
      [SHRINKING_CURVE]
    );

    expect(p).toMatchObject({
      radialSteps: 12,
      sections: 7,
      sectionRings: 2,
      capTop: false,
      capBottom: false,
    });
    expect(p.radius).toBeCloseTo(0.8, 6);
    expect(p.sectionLength).toBeCloseTo(0.5, 6);
    expect(p.curve?.points).toHaveLength(2);
  });

  it('holds the radius and the section length as single-precision floats', () => {
    const p = decodeTubeTrailMesh({ radius: '0.1', section_length: '0.1' }, []);

    expect(p.radius).toBe(Math.fround(0.1));
    expect(p.sectionLength).toBe(Math.fround(0.1));
  });

  it('keeps the default radius for a value approximately equal to it, as set_radius returns early', () => {
    expect(decodeTubeTrailMesh({ radius: '0.500001' }, []).radius).toBe(0.5);
  });

  it('keeps the default radial_steps outside 3 to 128', () => {
    for (const refused of ['2', '129', '0', '-4']) {
      expect(decodeTubeTrailMesh({ radial_steps: refused }, []).radialSteps).toBe(8);
    }
    expect(decodeTubeTrailMesh({ radial_steps: '3' }, []).radialSteps).toBe(3);
    expect(decodeTubeTrailMesh({ radial_steps: '128' }, []).radialSteps).toBe(128);
  });

  it('keeps the default sections outside 2 to 128', () => {
    for (const refused of ['1', '129', '0']) {
      expect(decodeTubeTrailMesh({ sections: refused }, []).sections).toBe(5);
    }
    expect(decodeTubeTrailMesh({ sections: '2' }, []).sections).toBe(2);
    expect(decodeTubeTrailMesh({ sections: '128' }, []).sections).toBe(128);
  });

  it('keeps the default section_rings outside 1 to 1024', () => {
    for (const refused of ['0', '1025', '-1']) {
      expect(decodeTubeTrailMesh({ section_rings: refused }, []).sectionRings).toBe(3);
    }
    expect(decodeTubeTrailMesh({ section_rings: '1' }, []).sectionRings).toBe(1);
    expect(decodeTubeTrailMesh({ section_rings: '1024' }, []).sectionRings).toBe(1024);
  });

  it('reads a curve that is missing, not a Curve or an ExtResource as no curve', () => {
    expect(decodeTubeTrailMesh({ curve: 'SubResource("none")' }, [SHRINKING_CURVE]).curve).toBeNull();
    expect(decodeTubeTrailMesh({ curve: 'ExtResource("1")' }, [SHRINKING_CURVE]).curve).toBeNull();
    expect(
      decodeTubeTrailMesh({ curve: 'SubResource("g")' }, [subResource('Gradient', 'g')]).curve
    ).toBeNull();
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const p = decodeTubeTrailMesh({ radius: 'nope', sections: 'nope' }, []);

    expect(p.radius).toBe(0.5);
    expect(p.sections).toBe(5);
    expect(warnSpy).toHaveBeenCalled();
  });
});
