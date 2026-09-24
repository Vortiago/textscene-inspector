/**
 * The bound we implement must be the bound the engine declared, read from the
 * `ClassDB.class_get_property_list(c, true)` capture (`pnpm nodes:properties`),
 * not from the hint quoted in a comment. A row is keyed by the declaring class,
 * so it reaches a resource validator through the base-walk (classBaseTypes.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter, loadRadianEpsilon } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const RESOURCE_PROPS = join(import.meta.dirname, 'resource-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
/** `PropertyInfo::hint` for `PROPERTY_HINT_RANGE`. */
const HINT_RANGE = 1;
/** `PropertyInfo::hint` for `PROPERTY_HINT_ENUM`. */
const HINT_ENUM = 2;

/** Loaded from the built combinator in `beforeAll`; see {@link hintBounds}. */
let RADIAN_ROUNDTRIP_EPSILON;

/**
 * Ends where the setter leaves no reachable band for the hint to warn on, since
 * it refuses or alters at or beyond the hint's number. A setter further out is
 * no override: `enforcedMin`/`enforcedMax` carries it beside the hint's
 * `min`/`max`. Per end: the other end is compared as usual.
 */
const SETTER_OVERRIDES_HINT = new Map([
  // The hint's -1 is the in-memory default the serializer omits. The setter's
  // ERR_FAIL_COND_MSG(p_bone_idx < 0) refuses it.
  ['PhysicalBone2D.bone2d_index', { end: 'min', cite: 'physical_bone_2d.cpp:229' }],
  // ERR_FAIL_COND(p_count < 1) sits above the hint's floor of 0.
  ['GPUParticles3D.draw_passes', { end: 'min', cite: 'gpu_particles_3d.cpp:266' }],
  // A clamp, not a refusal: `p > 4 ? p : 4` never stores 1..3, so the floor
  // sits above the hint's.
  ['CSGSphere3D.radial_segments', { end: 'min', cite: 'csg_shape.cpp:1489' }],
  // `size = p_size.maxf(0.001)` raises anything under 0.001, so the altered
  // floor sits above the hint's 0.
  ['Decal.size', { end: 'min', cite: 'decal.cpp:34' }],
]);

/**
 * Enum values a later supported release added, which the 4.6.3 capture lacks: a
 * `.tscn` does not say which release wrote it. Keyed by the values, so a bound
 * past both still fails, and `the capture already offers` fails a stale entry.
 */
const HINT_PREDATES_CAPTURE = new Map([
  // 4.7.2: viewport.h:197 DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_PARENT_NODE, and
  // viewport.cpp:4101 ERR_FAIL_INDEX now admits it.
  ['Viewport.canvas_item_default_texture_filter', { values: [4], cite: 'viewport.h:197' }],
  // 4.7.2: viewport.h:205 DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_PARENT_NODE.
  ['Viewport.canvas_item_default_texture_repeat', { values: [3], cite: 'viewport.h:205' }],
  // 4.7.2: gpu_particles_3d.h:55 TRANSFORM_ALIGN_LOCAL_BILLBOARD, listed by the
  // hint at gpu_particles_3d.cpp:894.
  ['GPUParticles3D.transform_align', { values: [4], cite: 'gpu_particles_3d.h:55' }],
]);

/**
 * A `PROPERTY_HINT_RANGE` string: `"lo,hi"` or `"lo,hi,step"`, then any of
 * `or_greater` / `or_less` / `exp` / `radians_as_degrees` / `degrees` /
 * `suffix:x` / `hide_slider`. `or_greater` and `or_less` open that end.
 */
function parseHint(hintString) {
  const parts = hintString.split(',').map((p) => p.trim());
  const lo = Number(parts[0]);
  const hi = Number(parts[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const flags = parts.slice(2);
  return {
    lo,
    hi,
    openMin: flags.includes('or_less'),
    openMax: flags.includes('or_greater'),
    // The inspector shows degrees, the `.tscn` stores radians. Converted, not
    // skipped: `v.radians` stores the converted bounds, so they compare.
    degrees: flags.includes('radians_as_degrees'),
  };
}

/**
 * The hint's bounds in the unit the `.tscn` stores, with the epsilon `v.radians`
 * builds in: a float32 PI reloads a hair off a float64 bound. Imported from the
 * combinator, never retyped, so the ledger and the code cannot drift.
 */
function hintBounds(hint) {
  if (!hint.degrees) return { lo: hint.lo, hi: hint.hi, tolerance: 0 };
  return {
    lo: (hint.lo * Math.PI) / 180 - RADIAN_ROUNDTRIP_EPSILON,
    hi: (hint.hi * Math.PI) / 180 + RADIAN_ROUNDTRIP_EPSILON,
    // A float32 round-trip near PI is ~2.4e-7, so this is wider than any real
    // drift and still catches a bound in the wrong place.
    tolerance: RADIAN_ROUNDTRIP_EPSILON / 100,
  };
}

/** Equal to within what the radian round-trip can move a bound. */
const sameBound = (ours, theirs, tolerance) => Math.abs(ours - theirs) <= tolerance;

/**
 * Every end where our bound and the hint's disagree, `exemptEnd` (`'min'` or
 * `'max'`, from `SETTER_OVERRIDES_HINT`) left out. Must be empty: a narrower
 * bound reports an error on a file Godot opens.
 */
function mismatches(hint, bounds, exemptEnd) {
  const out = [];
  const { min: ourMin, max: ourMax } = bounds ?? {};
  const min = exemptEnd === 'min' ? undefined : ourMin;
  const max = exemptEnd === 'max' ? undefined : ourMax;
  const { lo, hi, tolerance } = hintBounds(hint);
  // No `Number.MIN_VALUE` exemption: a setter refusing `<= 0` is spelled
  // `enforcedMin: { at: 0, exclusive: true }`, which leaves `min` free for the
  // hint's own floor.
  if (!hint.openMin && min !== undefined && !sameBound(min, lo, tolerance)) {
    out.push(`we floor at ${min}, engine at ${lo}`);
  }
  if (!hint.openMax && max !== undefined && !sameBound(max, hi, tolerance)) {
    out.push(`we cap at ${max}, engine at ${hi}`);
  }
  // `or_greater` / `or_less` opens that end, so a bound there rejects a value
  // the engine invites.
  if (hint.openMin && min !== undefined) {
    out.push(`we floor at ${min}, engine leaves that end open (or_less)`);
  }
  if (hint.openMax && max !== undefined) {
    out.push(`we cap at ${max}, engine leaves that end open (or_greater)`);
  }
  return out;
}

/**
 * Which ends the engine closes and we leave open: `['min']`, `['max']`, both or
 * none. Such a value goes unreported where it should draw a warning.
 */
function unimplementedEnds(hint, bounds) {
  const { min, max } = bounds ?? {};
  const ends = [];
  // Only `bounds.min` implements the hint. A setter floor further out
  // (`bounds.enforcedMin`) stays silent on the band the inspector excludes but
  // the engine loads.
  if (!hint.openMin && min === undefined) ends.push('min');
  if (!hint.openMax && max === undefined) ends.push('max');
  return ends;
}

/**
 * A `PROPERTY_HINT_ENUM` string: `"A,B,C"` from 0, or `"A:0,B:2,C:3"`. An
 * unsuffixed label continues from the last value + 1, as `ClassDB` reads it.
 * `null` for an empty string, which states no set to compare against.
 */
function parseEnumHint(hintString) {
  if (!hintString) return null;
  const values = [];
  let next = 0;
  for (const part of hintString.split(',')) {
    const label = part.trim();
    if (!label) continue;
    const suffix = label.lastIndexOf(':');
    if (suffix !== -1 && /^-?\d+$/.test(label.slice(suffix + 1))) {
      next = Number(label.slice(suffix + 1));
    }
    values.push(next);
    next += 1;
  }
  return values.length > 0 ? values : null;
}

/**
 * Where the values we accept and the values the hint offers disagree. A bound
 * wider than its hint is a warning that never fires. What the setter takes
 * decides the error tier, not this one.
 */
function enumMismatches(offered, bounds, addedLater = []) {
  const { min, max, values } = bounds ?? {};
  if (min === undefined && max === undefined) return [];
  const accepted = values ?? range(min ?? offered[0], max ?? offered[offered.length - 1]);
  const hint = new Set(offered);
  const ours = new Set(accepted);
  const laterRelease = new Set(addedLater);
  const extra = accepted.filter((v) => !hint.has(v) && !laterRelease.has(v));
  const missing = offered.filter((v) => !ours.has(v));
  const out = [];
  if (extra.length > 0) out.push(`we accept ${extra.join('/')}, the hint does not offer ${extra.length > 1 ? 'them' : 'it'}`);
  if (missing.length > 0) out.push(`we reject ${missing.join('/')}, the hint offers ${missing.length > 1 ? 'them' : 'it'}`);
  return out;
}

const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * The engine's ranged properties, from both captures. The keys cannot collide:
 * `Node` and `Resource` are separate branches under `Object`.
 */
function engineProperties() {
  return {
    ...JSON.parse(readFileSync(PROPS, 'utf8')),
    ...JSON.parse(readFileSync(RESOURCE_PROPS, 'utf8')),
  };
}

/** Every ranged engine property we register a validator for, with both bounds. */
async function rangedProperties() {
  const { validatorRegistry } = await loadCoreLinter();
  const engine = engineProperties();
  const rows = [];
  for (const [nodeType, properties] of Object.entries(engine)) {
    for (const property of properties) {
      if (property.hint !== HINT_RANGE) continue;
      const hint = parseHint(property.hint_string);
      if (!hint) continue;
      // A property we validate nowhere is `enginePropertyCoverage`'s subject,
      // not this one: absent coverage is a different claim from wrong coverage.
      const validator = validatorRegistry.declarationFor(nodeType, property.name);
      if (!validator) continue;
      rows.push({ label: `${nodeType}.${property.name}`, hint, bounds: validator.bounds });
    }
  }
  return rows;
}

/** The same question for `PROPERTY_HINT_ENUM`, whose bound is a SET of values. */
async function enumProperties() {
  const { validatorRegistry } = await loadCoreLinter();
  const engine = engineProperties();
  const rows = [];
  for (const [nodeType, properties] of Object.entries(engine)) {
    for (const property of properties) {
      if (property.hint !== HINT_ENUM) continue;
      const offered = parseEnumHint(property.hint_string);
      if (!offered) continue;
      const validator = validatorRegistry.declarationFor(nodeType, property.name);
      if (!validator) continue;
      rows.push({ label: `${nodeType}.${property.name}`, offered, bounds: validator.bounds });
    }
  }
  return rows;
}

describe('the bound we implement against the bound Godot declared', () => {
  // Not `existsSync(dist)`, which skips on no build and passes a stale one. In
  // `beforeAll`, not at module scope, where a throw during a concurrent `tsc
  // --build` surfaces as a collection error instead of this message.
  beforeAll(() => {
    requireFreshDist(CORE, 'this hint-parity ledger');
  });

  // Once for the file, not once per assertion.
  let rows;
  let enumRows;
  // 60s, not the 10s hook default: three ledgers load the barrel at once under
  // a full `--project scripts` run.
  beforeAll(async () => {
    RADIAN_ROUNDTRIP_EPSILON = await loadRadianEpsilon();
    rows = await rangedProperties();
    enumRows = await enumProperties();
  }, 60_000);

  it('bounds no end to a number the engine does not state', () => {
    // The floor first: a comparison over an empty list is green for the wrong
    // reason.
    expect(rows.length).toBeGreaterThan(200);

    const wrong = rows.flatMap((r) =>
      mismatches(r.hint, r.bounds, SETTER_OVERRIDES_HINT.get(r.label)?.end).map(
        (d) => `${r.label}: ${d}`
      )
    );
    expect(wrong.sort()).toEqual([]);
  });

  it('accepts exactly the values each enum hint offers', () => {
    expect(enumRows.length).toBeGreaterThan(50);
    // `SETTER_OVERRIDES_HINT` names a range end, which an enum has none of. An
    // enum's exemption is a value a later release added.
    const wrong = enumRows.flatMap((r) =>
      enumMismatches(r.offered, r.bounds, HINT_PREDATES_CAPTURE.get(r.label)?.values).map(
        (d) => `${r.label}: ${d}`
      )
    );
    expect(wrong.sort()).toEqual([]);
  });

  it('holds no HINT_PREDATES_CAPTURE entry the capture already offers', () => {
    // The entries are pin drift, not decisions, so a re-capture must retire
    // them.
    const byLabel = new Map(enumRows.map((r) => [r.label, r]));
    const stale = [];
    for (const [label, { values }] of HINT_PREDATES_CAPTURE) {
      const row = byLabel.get(label);
      if (!row) {
        stale.push(`${label}: no enum hint reaches this validator any more`);
        continue;
      }
      const offered = new Set(row.offered);
      const caughtUp = values.filter((value) => offered.has(value));
      if (caughtUp.length > 0) {
        stale.push(`${label}: the capture already offers ${caughtUp.join('/')}`);
      }
    }
    expect(stale.sort()).toEqual([]);
  });

  it('reaches the Resource hints, not only the Node ones', () => {
    // Named, since a missing `resource-properties.json` leaves the Node half
    // over the floor above and this guard green.
    const labels = new Set(rows.map((r) => r.label));
    expect(
      [
        'Environment.tonemap_agx_contrast',
        'Environment.tonemap_agx_white',
        'Environment.tonemap_white',
      ].filter((label) => !labels.has(label))
    ).toEqual([]);
  });

  it('implements every end the engine closes', () => {
    // No exceptions list: an entry would need a reason the end cannot be
    // expressed at all.
    const open = rows
      .flatMap((r) => unimplementedEnds(r.hint, r.bounds).map((end) => `${r.label} ${end}`))
      .sort();
    expect(open).toEqual([]);
  });

  it('holds no override for a property that no longer departs from the engine', () => {
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    // Dead when exempting the named end removes no mismatch.
    const dead = [...SETTER_OVERRIDES_HINT.entries()]
      .filter(([label, { end }]) => {
        const row = byLabel.get(label);
        if (row === undefined) return true;
        return (
          mismatches(row.hint, row.bounds).length === mismatches(row.hint, row.bounds, end).length
        );
      })
      .map(([label]) => label);
    expect(dead).toEqual([]);
  });

  it('cites an engine line for every override', () => {
    const uncited = [...SETTER_OVERRIDES_HINT.entries()]
      .filter(([, { end, cite }]) => !['min', 'max'].includes(end) || !/^[\w/]+\.(cpp|h):\d+$/.test(cite))
      .map(([label, { end, cite }]) => `${label}: ${end} ${cite}`);
    expect(uncited).toEqual([]);
  });
});
