/**
 * Issue #175 (part 2) — finish the value-decoder sweep: the residual NaN-leak / crash sites
 * PR #210 did not reach.
 *
 * RED contract. #210 shared the canonical grammar leaf and converted control / camera3d /
 * directionallight3d / lights-shared / meshinstance3d + the promoted helpers
 * (`floatOr` / `intOr` / `vec2Or` / `parseOptionalFloat` / `parseOptionalInt` /
 * `parseColorOrUndefined`). This pins the sibling PARSER slices that still carry the same drift,
 * so #175 is finished — not a representative subset (an earlier pass under-pinned and shipped a
 * partial sweep). Every case below fails against the current (unfixed) sibling slices.
 *
 * The contract (same framing as part 1):
 *   - a concrete-default scalar (a numeric literal default) routes through floatOr/intOr —
 *     warn-then-fall-back on truthy garbage, never NaN;
 *   - an optional scalar (absent means "unset") falls to `undefined`, never NaN;
 *   - a malformed vector/color falls back to the slice's OWN default and never throws /
 *     never stores NaN;
 *   - an authored value and an absent value are both honoured unchanged.
 *
 * These are the pinned cases; each converted slice keeps its co-located parser test (its
 * property->field mapping). The NaN-safe re-declared-decoder consolidation (csgcylinder /
 * mesh parsers) is driven by the plan + verified by /code-review, not pinned here (a
 * behaviour-preserving refactor has no meaningful RED pin).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import { heading } from './testing/parserKit';
import { parseSpotLight3D } from '../nodes/3d/lights/spotlight3d/parser';
import { parseOmniLight3D } from '../nodes/3d/lights/omnilight3d/parser';
import { parseLabel3D } from '../nodes/3d/label3d/parser';
import { parseEnvironment } from '../resources/environment/parser';
import { parseBoxShape3D } from '../resources/shapes/boxshape3d/parser';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const spotHeading = () => heading('SpotLight3D', { name: 'Spot', parent: '.' });
const omniHeading = () => heading('OmniLight3D', { name: 'Omni', parent: '.' });
const labelHeading = () => heading('Label3D', { name: 'Label', parent: '.' });

// ---------------------------------------------------------------------------------------------
// SpotLight3D — concrete-default scalars: warn-then-fall-back, never NaN
// ---------------------------------------------------------------------------------------------
describe('#175 spotlight3d — scalar reads stop leaking NaN', () => {
  it('honours authored values', () => {
    const r = parseSpotLight3D(spotHeading(), {
      spot_range: '10',
      spot_angle: '30',
      spot_attenuation: '2',
      spot_angle_attenuation: '0.5',
    });
    expect(r.spot_range).toBe(10);
    expect(r.spot_angle).toBe(30);
    expect(r.spot_attenuation).toBe(2);
    expect(r.spot_angle_attenuation).toBe(0.5);
  });

  it('falls back to each Godot default on garbage (never NaN) and warns', () => {
    const r = parseSpotLight3D(spotHeading(), {
      spot_range: 'garbage',
      spot_angle: 'garbage',
      spot_attenuation: 'garbage',
      spot_angle_attenuation: 'garbage',
    });
    expect(r.spot_range).toBe(5.0);
    expect(r.spot_angle).toBe(45.0);
    expect(r.spot_attenuation).toBe(1.0);
    expect(r.spot_angle_attenuation).toBe(1.0);
    expect(Number.isNaN(r.spot_range)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('an absent scalar falls back silently (no warn)', () => {
    const r = parseSpotLight3D(spotHeading(), {});
    expect(r.spot_range).toBe(5.0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// OmniLight3D — concrete scalars + the optional omni_shadow_mode (undefined, never NaN)
// ---------------------------------------------------------------------------------------------
describe('#175 omnilight3d — scalars + optional shadow mode', () => {
  it('honours authored values', () => {
    const r = parseOmniLight3D(omniHeading(), {
      omni_range: '12',
      omni_attenuation: '2',
      omni_shadow_mode: '1',
    });
    expect(r.omni_range).toBe(12);
    expect(r.omni_attenuation).toBe(2);
    expect(r.omni_shadow_mode).toBe(1);
  });

  it('concrete scalars fall back to their default on garbage (never NaN)', () => {
    const r = parseOmniLight3D(omniHeading(), {
      omni_range: 'garbage',
      omni_attenuation: 'garbage',
    });
    expect(r.omni_range).toBe(5.0);
    expect(r.omni_attenuation).toBe(1.0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('the OPTIONAL omni_shadow_mode falls to undefined on garbage, never NaN', () => {
    const r = parseOmniLight3D(omniHeading(), { omni_shadow_mode: 'garbage' });
    expect(r.omni_shadow_mode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Label3D — pixel_size / outline_size
// ---------------------------------------------------------------------------------------------
describe('#175 label3d — pixel_size / outline_size stop leaking NaN', () => {
  it('honours authored values', () => {
    const r = parseLabel3D(labelHeading(), { pixel_size: '0.01', outline_size: '20' });
    expect(r.pixel_size).toBe(0.01);
    expect(r.outline_size).toBe(20);
  });

  it('falls back to the Godot default on garbage (never NaN) and warns', () => {
    const r = parseLabel3D(labelHeading(), { pixel_size: 'garbage', outline_size: 'garbage' });
    expect(r.pixel_size).toBe(0.005);
    expect(r.outline_size).toBe(12);
    expect(Number.isNaN(r.pixel_size)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// Environment — 13 concrete scalars (float + int) AND the present-but-malformed COLOR CRASH
// ---------------------------------------------------------------------------------------------
describe('#175 environment — scalar reads stop leaking NaN', () => {
  it('honours authored values', () => {
    const r = parseEnvironment({
      background_energy_multiplier: '2.5',
      tonemap_white: '3',
      fog_density: '0.2',
      background_mode: '2',
      tonemap_mode: '3',
    });
    expect(r.background_energy_multiplier).toBe(2.5);
    expect(r.tonemap_white).toBe(3);
    expect(r.fog_density).toBe(0.2);
    expect(r.background_mode).toBe(2);
    expect(r.tonemap_mode).toBe(3);
  });

  it('float scalars fall back to their default on garbage (never NaN) and warn', () => {
    const r = parseEnvironment({
      background_energy_multiplier: 'garbage',
      fog_density: 'garbage',
      ambient_light_energy: 'garbage',
      adjustment_saturation: 'garbage',
    });
    expect(r.background_energy_multiplier).toBe(1.0);
    expect(r.fog_density).toBe(0.01);
    expect(r.ambient_light_energy).toBe(1.0);
    expect(r.adjustment_saturation).toBe(1.0);
    expect(Number.isNaN(r.background_energy_multiplier)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('int scalars fall back to their default on garbage (never NaN)', () => {
    const r = parseEnvironment({
      background_mode: 'garbage',
      tonemap_mode: 'garbage',
      fog_mode: 'garbage',
    });
    expect(r.background_mode).toBe(0);
    expect(r.tonemap_mode).toBe(0);
    expect(r.fog_mode).toBe(0);
    expect(Number.isNaN(r.tonemap_mode)).toBe(false);
  });
});

describe('#175 environment — a malformed color must NOT crash the whole parse', () => {
  it('honours a valid color', () => {
    const r = parseEnvironment({ background_color: 'Color(1, 0, 0, 1)' });
    expect(r.background_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('a present-but-malformed color falls back to that field OWN default (no throw)', () => {
    // Currently routes through the THROWING parseColor with no catch -> the whole
    // parseEnvironment throws on a malformed color. It must fall back instead.
    expect(() => parseEnvironment({ background_color: 'Color(oops)' })).not.toThrow();
    const r = parseEnvironment({ background_color: 'Color(oops)', ambient_light_color: 'nope' });
    // background_color default is black; ambient_light_color default is black too.
    expect(r.background_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(r.ambient_light_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('preserves each color field its own (non-black) default when malformed', () => {
    // fog_light_color's Godot default is a bluish grey — the fallback must be per-field,
    // not a generic white/black.
    const r = parseEnvironment({ fog_light_color: 'garbage' });
    expect(r.fog_light_color).toEqual({ r: 0.518, g: 0.553, b: 0.608, a: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// BoxShape3D — the local loose-regex Vector3 leaks NaN on double-sign / dangling-exp input
// ---------------------------------------------------------------------------------------------
describe('#175 boxshape3d — size uses the canonical anchored grammar', () => {
  it('honours a valid size', () => {
    expect(parseBoxShape3D({ size: 'Vector3(2, 3, 4)' }).size).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to the {1,1,1} default (never {x: NaN}) for loose-regex-only garbage', () => {
    // The old local `[-\d.eE+]+` class matches `--1` / `1e-` and yields NaN; the anchored
    // canonical parseVector3 rejects them, so the try/catch restores the default.
    expect(parseBoxShape3D({ size: 'Vector3(--1, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(parseBoxShape3D({ size: 'Vector3(1e-, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
