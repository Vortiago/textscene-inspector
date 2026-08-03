/**
 * Tests for the CylinderMesh decode.
 *
 * Defaults from Godot `primitive_meshes.h:199-205`. `set_radial_segments`
 * (`primitive_meshes.cpp:1342-1352`) floors at 4; `set_rings` (:1355-1366)
 * ERR_FAILs below 0, keeping the default. The radii and height have no guards
 * (:1300-1339), so a cone (`top_radius = 0`) and a squat cylinder are both legal.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeCylinderMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeCylinderMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeCylinderMesh({})).toEqual({
      top_radius: 0.5,
      bottom_radius: 0.5,
      height: 2,
      radial_segments: 64,
      rings: 4,
      capTop: true,
      capBottom: true,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field, including a cone (top_radius 0)', () => {
    expect(
      decodeCylinderMesh({
        top_radius: '0',
        bottom_radius: '2',
        height: '5',
        radial_segments: '8',
        rings: '2',
        cap_top: 'false',
        cap_bottom: 'false',
      })
    ).toEqual({
      top_radius: 0,
      bottom_radius: 2,
      height: 5,
      radial_segments: 8,
      rings: 2,
      capTop: false,
      capBottom: false,
    });
  });

  it('floors radial_segments at 4, not merely at 0', () => {
    expect(decodeCylinderMesh({ radial_segments: '1' }).radial_segments).toBe(4);
    expect(decodeCylinderMesh({ radial_segments: '-6' }).radial_segments).toBe(4);
    expect(decodeCylinderMesh({ radial_segments: '32' }).radial_segments).toBe(32);
  });

  it('rejects rings below 0 (ERR_FAIL keeps the default 4) but allows 0', () => {
    expect(decodeCylinderMesh({ rings: '-1' }).rings).toBe(4);
    expect(decodeCylinderMesh({ rings: '0' }).rings).toBe(0);
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const p = decodeCylinderMesh({ height: 'nope', radial_segments: 'nope' });
    expect(p.height).toBe(2);
    expect(p.radial_segments).toBe(64);
    expect(warnSpy).toHaveBeenCalled();
  });
});
