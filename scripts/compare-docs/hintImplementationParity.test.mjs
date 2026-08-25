/**
 * The bound we implement must be the bound the ENGINE declared.
 *
 * Sits between two guards that both pass on the gap. `boundGrounding` asks
 * whether a bound carries a citation; the citation sweep asks whether that
 * citation points at a real engine line. Neither asks whether the NUMBERS
 * agree, so `Polygon2D.internal_vertex_count` shipped with a correct cite, a
 * comment correctly quoting `"0,1000"`, and a validator carrying only the
 * floor — and its own slice test agreed, because it was written from the code.
 *
 * Not the quoted hint in the COMMENT beside each validator: that works, and is
 * the wrong altitude, because the comment is a hand-copy of an authoritative
 * record that already exists here.
 * `node-properties.json` and `resource-properties.json` are a live
 * `ClassDB.class_get_property_list(c, true)` captured by `pnpm
 * nodes:properties`. Reading the engine's own capture instead of our prose
 * deletes every special case the text version needed: no distinguishing
 * `PROPERTY_HINT_ENUM`'s numeric label list from a range (the capture states
 * the hint as a number), no paren-balance walk to find the bound near the
 * comment, no floor on how many comments were found to stop the subject being
 * deleted along with the evidence.
 *
 * A row is keyed by the class that DECLARES the property, so it only reaches a
 * resource validator because the base-walk now covers Godot's resource
 * ancestry (classBaseTypes.ts). Registered on the leaf a scene names, as
 * `StandardMaterial3D`'s once were, they would be invisible here.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter, loadRadianEpsilon } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const RESOURCE_PROPS = join(import.meta.dirname, 'resource-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
// Not `existsSync(dist)`: that cannot tell a fresh build from one predating
// the very change being measured, and it SKIPS rather than fails, so a run
// with no build at all reads green over a guard that never executed.
//
// Computed in `beforeAll`, never at module scope: it walks a tree a concurrent
// `tsc --build` may be writing, and a throw during module evaluation surfaces
// as a vitest collection error instead of the actionable message.

/** `PropertyInfo::hint` for `PROPERTY_HINT_RANGE`. */
const HINT_RANGE = 1;
/** `PropertyInfo::hint` for `PROPERTY_HINT_ENUM`. */
const HINT_ENUM = 2;

/** Loaded from the built combinator in `beforeAll`; see {@link hintBounds}. */
let RADIAN_ROUNDTRIP_EPSILON;

/**
 * Ends where the code departs from the hint on purpose, because the SETTER
 * disagrees with it and the setter is what the engine enforces.
 *
 * Each names the engine guard that justifies it, so a reader can check the
 * claim rather than take it. An entry that stops describing a real divergence
 * fails below rather than sitting here forever.
 */
const SETTER_OVERRIDES_HINT = new Map([
  // Only ends where the setter leaves NO reachable band for the hint to warn
  // on, because it refuses or alters at or beyond the hint's own number. An end
  // whose setter sits FURTHER OUT than the hint is not an override: both tiers
  // are reachable, and `enforcedMin`/`enforcedMax` carries the setter's while
  // `min`/`max` keeps the hint's, so nothing needs exempting.
  //
  // The hint's -1 is the in-memory default the serializer omits; the setter's
  // ERR_FAIL_COND_MSG(p_bone_idx < 0) refuses it outright.
  ['PhysicalBone2D.bone2d_index', 'physical_bone_2d.cpp:229'],
  // ERR_FAIL_COND(p_count < 1) sits ABOVE the hint's floor of 0.
  ['GPUParticles3D.draw_passes', 'gpu_particles_3d.cpp:266'],
  // A clamp, not a refusal: `p > 4 ? p : 4` means 1..3 are values Godot never
  // stores, so the floor sits ABOVE the hint's.
  ['CSGSphere3D.radial_segments', 'csg_shape.cpp:1489'],
  // `size = p_size.maxf(0.001)` raises anything under 0.001 rather than refusing
  // it, so the altered floor sits ABOVE the hint's 0.
  ['Decal.size', 'decal.cpp:34'],
]);

/**
 * A `PROPERTY_HINT_RANGE` string as the engine states it: `"lo,hi"`,
 * `"lo,hi,step"`, then any of `or_greater` / `or_less` / `exp` / `radians_as_degrees`
 * / `degrees` / `suffix:x` / `hide_slider`.
 *
 * `or_greater` and `or_less` OPEN that end — the value is no longer bounded
 * there, so nothing to compare. A `suffix:` is a unit and never a bound.
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
    // The inspector shows degrees while the `.tscn` stores radians, so the
    // engine's numbers and ours are in different units. Converted rather than
    // skipped: `v.radians` stores the converted bounds, so the two ARE
    // comparable, and skipping them hid 46 ranged properties from every
    // assertion here, 33 of them closed at both ends.
    degrees: flags.includes('radians_as_degrees'),
  };
}

/**
 * The hint's bounds in the unit the `.tscn` stores, with the tolerance
 * `v.radians` builds in.
 *
 * That epsilon is not slack this file invents: Godot stores these as float32
 * and writes them back in decimal, so a value the editor set to exactly PI
 * reloads a hair off and a bound at float64 PI would reject the engine's own
 * output. Imported from the combinator that applies it, never retyped, or the
 * ledger and the code it measures drift by exactly the amount being compared.
 */
function hintBounds(hint) {
  if (!hint.degrees) return { lo: hint.lo, hi: hint.hi, tolerance: 0 };
  return {
    lo: (hint.lo * Math.PI) / 180 - RADIAN_ROUNDTRIP_EPSILON,
    hi: (hint.hi * Math.PI) / 180 + RADIAN_ROUNDTRIP_EPSILON,
    // A float32 round-trip near PI is ~2.4e-7, so this is comfortably wider
    // than any real drift while still catching a bound in the wrong place.
    tolerance: RADIAN_ROUNDTRIP_EPSILON / 100,
  };
}

/** Equal to within what the radian round-trip can move a bound. */
const sameBound = (ours, theirs, tolerance) => Math.abs(ours - theirs) <= tolerance;

/**
 * Ends we bound to a DIFFERENT number than the engine states.
 *
 * The consequential half. A bound in the wrong place accepts or rejects values
 * by the wrong rule, and when ours is the narrower one it reports an error on a
 * file Godot opens — this repo's recurring defect. Must be empty.
 */
function mismatches(hint, bounds) {
  const out = [];
  const { min, max } = bounds ?? {};
  const { lo, hi, tolerance } = hintBounds(hint);
  // No `Number.MIN_VALUE` exemption, and none needed. A setter refusing `<= 0`
  // is spelled `enforcedMin: { at: 0, exclusive: true }`, which leaves the `min`
  // slot free to carry the hint's own floor, so the two tiers no longer compete
  // for one number and there is nothing to exempt. The old blanket rule was
  // exempting eight properties whose floor was fabricated rather than derived,
  // and could be reached by switching combinator, so a red here had a way to be
  // silenced that was not implementing the bound.
  if (!hint.openMin && min !== undefined && !sameBound(min, lo, tolerance)) {
    out.push(`we floor at ${min}, engine at ${lo}`);
  }
  if (!hint.openMax && max !== undefined && !sameBound(max, hi, tolerance)) {
    out.push(`we cap at ${max}, engine at ${hi}`);
  }
  // The policy's other half, which nothing checked: `or_greater` / `or_less`
  // OPENS that end, so a bound there rejects a value the engine invites.
  if (hint.openMin && min !== undefined) {
    out.push(`we floor at ${min}, engine leaves that end open (or_less)`);
  }
  if (hint.openMax && max !== undefined) {
    out.push(`we cap at ${max}, engine leaves that end open (or_greater)`);
  }
  return out;
}

/**
 * Which ends the engine closes and we leave open — `['min']`, `['max']`, both or
 * none.
 *
 * A value past a hint goes unreported where it should draw a warning: it costs a
 * diagnostic rather than causing a false one, which is why this half is a list
 * of exceptions and the mismatch half must be empty.
 */
function unimplementedEnds(hint, bounds) {
  const { min, max } = bounds ?? {};
  const ends = [];
  // `bounds.min` is the OUTER end, so a setter floor further out
  // (`bounds.enforcedMin`) does not implement the hint's: it reports the values
  // the engine refuses and stays silent on the band the inspector excludes but
  // the engine loads. Reading either slot here counted three properties as
  // implemented while `TextEdit.caret_blink_interval = 0.05`,
  // `CSGSphere3D.radius = 0.0005` and `AudioStreamPlayer.pitch_scale = 0.005`
  // all passed without a word.
  if (!hint.openMin && min === undefined) ends.push('min');
  if (!hint.openMax && max === undefined) ends.push('max');
  return ends;
}

/**
 * A `PROPERTY_HINT_ENUM` string as the engine states it: `"A,B,C"`, numbering
 * from 0, or `"A:0,B:2,C:3"` where a label carries its own value and the set
 * can skip one. A later unsuffixed label continues from the last value + 1,
 * which is how `ClassDB` itself reads them.
 *
 * `null` for a hint with no string: an empty `PROPERTY_HINT_ENUM` states no
 * set at all, so there is nothing to compare a bound against.
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
 * Where the values we accept and the values the hint offers disagree.
 *
 * A bound WIDER than its hint is the consequential half here — it is the
 * warning that never fires, so nothing downstream can notice the value is one
 * the inspector cannot produce. Five enums shipped that way, all of them
 * reasoning from what the SETTER takes, which is the error tier's question.
 */
function enumMismatches(offered, bounds) {
  const { min, max, values } = bounds ?? {};
  if (min === undefined && max === undefined) return [];
  const accepted = values ?? range(min ?? offered[0], max ?? offered[offered.length - 1]);
  const hint = new Set(offered);
  const ours = new Set(accepted);
  const extra = accepted.filter((v) => !hint.has(v));
  const missing = offered.filter((v) => !ours.has(v));
  const out = [];
  if (extra.length > 0) out.push(`we accept ${extra.join('/')}, the hint does not offer ${extra.length > 1 ? 'them' : 'it'}`);
  if (missing.length > 0) out.push(`we reject ${missing.join('/')}, the hint offers ${missing.length > 1 ? 'them' : 'it'}`);
  return out;
}

const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * The engine's ranged properties, from both captures.
 *
 * Merging the two maps is safe because their keys cannot collide: `Node` and
 * `Resource` are separate branches under `Object`, and `enumerate-nodes.gd`
 * keys each blob by class name within one hierarchy.
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
      const validator = validatorRegistry.findValidator(nodeType, property.name);
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
      const validator = validatorRegistry.findValidator(nodeType, property.name);
      if (!validator) continue;
      rows.push({ label: `${nodeType}.${property.name}`, offered, bounds: validator.bounds });
    }
  }
  return rows;
}

describe('the bound we implement against the bound Godot declared', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with a previous revision's registry.
  beforeAll(() => {
    requireFreshDist(CORE, 'this hint-parity ledger');
  });

  // Once for the file, not once per assertion: loading the built linter and
  // walking the capture is the whole cost here, and paying it three times took
  // the first test past vitest's 5s default under a full concurrent run.
  let rows;
  // 60s, matching the suite option above rather than the 10s hook default.
  // Loading the built barrel is the whole cost of this file, and three ledgers
  // do it at once under a full `--project scripts` run — comfortably fast
  // alone, and over the default when they contend.
  let enumRows;
  beforeAll(async () => {
    RADIAN_ROUNDTRIP_EPSILON = await loadRadianEpsilon();
    rows = await rangedProperties();
    enumRows = await enumProperties();
  }, 60_000);

  it('bounds no end to a number the engine does not state', () => {
    // The floor first: a comparison over an empty list is green for the wrong
    // reason, and this one depends on a build, a capture and a registry all
    // lining up.
    expect(rows.length).toBeGreaterThan(200);

    const wrong = rows
      .filter((r) => !SETTER_OVERRIDES_HINT.has(r.label))
      .flatMap((r) => mismatches(r.hint, r.bounds).map((d) => `${r.label}: ${d}`));
    expect(wrong.sort()).toEqual([]);
  });

  it('accepts exactly the values each enum hint offers', () => {
    // The same claim as the range assertion above, for the hint that states a
    // SET instead of two ends. Uncovered until five enums had shipped bounds
    // wider than the hint they cited — every one of them reasoning from what
    // the setter accepts, which decides the ERROR tier and not this one.
    expect(enumRows.length).toBeGreaterThan(50);
    const wrong = enumRows
      .filter((r) => !SETTER_OVERRIDES_HINT.has(r.label))
      .flatMap((r) => enumMismatches(r.offered, r.bounds).map((d) => `${r.label}: ${d}`));
    expect(wrong.sort()).toEqual([]);
  });

  it('reaches the Resource hints, not only the Node ones', () => {
    // Named exactly, because a missing or empty `resource-properties.json`
    // leaves the Node half alone comfortably over the floor above and this
    // guard green while covering nothing it was extended to cover. These three
    // were a source-comment guard's entire subject before the capture reached
    // Resource classes.
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
    // No exceptions list, and none earned: every closed hint end in the engine's
    // capture is coded. An entry here would need a reason the end cannot be
    // expressed at all, not a reason it is inconvenient.
    const open = rows
      .flatMap((r) => unimplementedEnds(r.hint, r.bounds).map((end) => `${r.label} ${end}`))
      .sort();
    expect(open).toEqual([]);
  });

  it('holds no override for a property that no longer departs from the engine', () => {
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    const dead = [...SETTER_OVERRIDES_HINT.keys()].filter((label) => {
      const row = byLabel.get(label);
      return row === undefined || mismatches(row.hint, row.bounds).length === 0;
    });
    expect(dead).toEqual([]);
  });

  it('cites an engine line for every override', () => {
    // Same standard the bounds themselves are held to: a roster whose reasons
    // cannot be checked is a list of opinions.
    const uncited = [...SETTER_OVERRIDES_HINT.entries()]
      .filter(([, cite]) => !/^[\w/]+\.(cpp|h):\d+$/.test(cite))
      .map(([label, cite]) => `${label}: ${cite}`);
    expect(uncited).toEqual([]);
  });
});
