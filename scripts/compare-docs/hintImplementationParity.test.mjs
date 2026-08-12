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
 * An earlier version of this guard read the quoted hint out of the COMMENT
 * beside each validator. That worked, and was the wrong altitude: the comment
 * is a hand-copy of an authoritative record that already exists here.
 * `node-properties.json` is a live `ClassDB.class_get_property_list(c, true)`
 * captured by `pnpm nodes:properties` — 227 classes, 542 of their properties
 * carrying a `PROPERTY_HINT_RANGE`. Reading the engine's own capture instead of
 * our prose deletes every special case the text version needed: no
 * distinguishing `PROPERTY_HINT_ENUM`'s numeric label list from a range (the
 * capture states the hint as a number), no paren-balance walk to find the bound
 * near the comment, no floor on how many comments were found to stop the
 * subject being deleted along with the evidence.
 *
 * Scope, stated because it is not the whole subject: the capture is Node
 * classes only, so the two Resource slices that quote a hint range
 * (`Environment`, `StandardMaterial3D`) are not covered here. Extending
 * `enumerate-nodes.gd` to `Resource` subclasses is the way in, and needs a
 * local Godot rather than a new mechanism.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCoreLinter } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const DIST = join(import.meta.dirname, '../../packages/textscene-core/dist/linter/index.js');
const built = existsSync(DIST);

/** `PropertyInfo::hint` for `PROPERTY_HINT_RANGE`. */
const HINT_RANGE = 1;

/**
 * Ends where the code departs from the hint on purpose, because the SETTER
 * disagrees with it and the setter is what the engine enforces.
 *
 * Each names the engine guard that justifies it, so a reader can check the
 * claim rather than take it. An entry that stops describing a real divergence
 * fails below rather than sitting here forever.
 */
const SETTER_OVERRIDES_HINT = new Map([
  // Window.content_scale_factor and OpenXRCompositionLayerCylinder.aspect_ratio
  // used to sit here; both are the strictly-positive shape `mismatches` now
  // recognises as a class, so an entry for either would exempt nothing.
  // The hint's -1 is the in-memory default the serializer omits; the setter's
  // ERR_FAIL_COND_MSG(p_bone_idx < 0) refuses it outright.
  ['PhysicalBone2D.bone2d_index', 'physical_bone_2d.cpp:229'],
  // ERR_FAIL_COND(p_count < 1) sits ABOVE the hint's floor of 0, so the hint
  // leaves no reachable band to warn on and the enforced floor is the only bound.
  ['GPUParticles3D.draw_passes', 'gpu_particles_3d.cpp:266'],
  // Both below: the setter's floor sits BELOW the hint's, so `[enforced, hinted)`
  // is a real hint-only sliver that goes unreported. One `min` slot holds one
  // tier and it must be the more severe, or a value the setter refuses would
  // report as a warning.
  ['GeometryInstance3D.lod_bias', 'visual_instance_3d.cpp:387'],
  ['NavigationAgent3D.height', 'navigation_agent_3d.cpp:618'],
  ['NavigationAgent2D.radius', 'navigation_agent_2d.cpp:571'],
  ['NavigationAgent2D.max_speed', 'navigation_agent_2d.cpp:620'],
  ['NavigationAgent3D.radius', 'navigation_agent_3d.cpp:608'],
  ['NavigationAgent3D.max_speed', 'navigation_agent_3d.cpp:684'],
  // CLAMP(p, 0.1, 2.0) passes [0.1, 0.25) through unaltered, so the hint's 0.25
  // is advisory and the clamp's 0.1 is the end that alters a value.
  ['Viewport.scaling_3d_scale', 'viewport.cpp:4875'],
  // Setter floors named independently of the hint, and below it.
  ['CSGPolygon3D.depth', 'csg_shape.cpp:2651'],
  ['CSGPolygon3D.spin_degrees', 'csg_shape.cpp:2681'],
  ['AudioStreamPlayer3D.emission_angle_degrees', 'audio_stream_player_3d.cpp:687'],
  // The floor is the setter's predicate reproduced exactly, `0.01 - CMP_EPSILON`.
  ['LightmapGI.texel_scale', 'lightmap_gi.cpp:1749'],
  // One ERR_FAIL_COND spanning 0..128 inclusive, WIDER than the hint at both
  // ends. The 128 is the literal in the predicate, not a power-of-two guess.
  ['AnimationMixer.audio_max_polyphony', 'animation_mixer.cpp:542'],
  // A clamp, not a refusal: `p > 4 ? p : 4` means 1..3 are values Godot never
  // stores, so the floor sits ABOVE the hint's and leaves no band to warn on.
  ['CSGSphere3D.radial_segments', 'csg_shape.cpp:1489'],
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
    // engine's numbers and ours are in different units and not comparable.
    degrees: flags.includes('radians_as_degrees'),
  };
}

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
  // `Number.MIN_VALUE` is not a number anyone chose — it is how "the setter
  // refuses anything <= 0" is spelled, from an `ERR_FAIL_COND(p_x <= 0)`. Around
  // two dozen properties pair it with a hint whose floor sits higher, and the
  // story is the same every time: the enforced floor is the real one, the band
  // between them is a hint-only sliver, and one `min` slot must hold the more
  // severe end. Listing them individually would be two dozen copies of one fact.
  if (!hint.openMin && min !== undefined && min !== Number.MIN_VALUE && min !== hint.lo) {
    out.push(`we floor at ${min}, engine at ${hint.lo}`);
  }
  if (!hint.openMax && max !== undefined && max !== hint.hi) {
    out.push(`we cap at ${max}, engine at ${hint.hi}`);
  }
  return out;
}

/**
 * Ends the engine closes and we leave open.
 *
 * The cheaper half: a value past the hint goes unreported where it should draw
 * a warning, which costs a diagnostic rather than causing a false one. Counted
 * rather than listed, as a ledger that only goes DOWN — the same shape
 * `enginePropertyCoverage` uses, and for the same reason: the population is a
 * standing backlog, so demanding zero today would mean exempting a hundred
 * entries and learning nothing from any of them.
 */
function unimplementedEnds(hint, bounds) {
  const { min, max } = bounds ?? {};
  let count = 0;
  if (!hint.openMin && min === undefined) count++;
  if (!hint.openMax && max === undefined) count++;
  return count;
}

/**
 * Ends the engine closes and we leave open, as a ledger.
 *
 * Measured at 102 when the engine-data comparison replaced the comment scrape,
 * which is the first time anything in this repo could see them: the text guard
 * only ever looked where a comment happened to quote a hint. Lower it by
 * implementing a bound, never by widening what counts.
 */
const UNIMPLEMENTED_HINT_ENDS = 101;

/** Every ranged engine property we register a validator for, with both bounds. */
async function rangedProperties() {
  const { validatorRegistry } = await loadCoreLinter();
  const engine = JSON.parse(readFileSync(PROPS, 'utf8'));
  const rows = [];
  for (const [nodeType, properties] of Object.entries(engine)) {
    for (const property of properties) {
      if (property.hint !== HINT_RANGE) continue;
      const hint = parseHint(property.hint_string);
      if (!hint || hint.degrees) continue;
      // A property we validate nowhere is `enginePropertyCoverage`'s subject,
      // not this one: absent coverage is a different claim from wrong coverage.
      const validator = validatorRegistry.findValidator(nodeType, property.name);
      if (!validator) continue;
      rows.push({ label: `${nodeType}.${property.name}`, hint, bounds: validator.bounds });
    }
  }
  return rows;
}

describe.skipIf(!built)('the bound we implement against the bound Godot declared', () => {
  // Once for the file, not once per assertion: loading the built linter and
  // walking the capture is the whole cost here, and paying it three times took
  // the first test past vitest's 5s default under a full concurrent run.
  let rows;
  beforeAll(async () => {
    rows = await rangedProperties();
  });

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

  it('leaves no more hint ends unimplemented than the ledger allows', () => {
    const open = rows.reduce((sum, r) => sum + unimplementedEnds(r.hint, r.bounds), 0);
    // Exact, not a ceiling: it must fall when a bound is implemented and rise
    // only when someone means it to, and both require editing the constant.
    expect(open).toBe(UNIMPLEMENTED_HINT_ENDS);
  });

  it('holds no override for a property that no longer departs from the engine', () => {
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    const dead = [...SETTER_OVERRIDES_HINT.keys()].filter((label) => {
      const row = byLabel.get(label);
      return row === undefined || mismatches(row.hint, row.bounds).length === 0;
    });
    expect(dead).toEqual([]);
  });
});
