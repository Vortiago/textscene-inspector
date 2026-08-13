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
import { stalenessMessage } from '../distFreshness.mjs';
import { loadCoreLinter } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const RESOURCE_PROPS = join(import.meta.dirname, 'resource-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
// Not `existsSync(dist)`: that cannot tell a fresh build from one predating
// the very change being measured, and it SKIPS rather than fails, so a run
// with no build at all reads green over a guard that never executed.
const stale = stalenessMessage(CORE, 'this hint-parity ledger');

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
  // sit in STRICTLY_POSITIVE_SETTER below instead: their divergence is the
  // shared `<= 0` refusal, not a floor named independently of the hint.
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
  // `ERR_FAIL_COND(p_size <= CMP_EPSILON)` refuses at 1e-5, two orders below
  // the hint's 0.001, so the band between them loads and the enforced end wins.
  ['Camera3D.size', 'camera_3d.cpp:731'],
]);

/**
 * Properties whose setter refuses everything `<= 0` while the hint's floor sits
 * higher, so `Number.MIN_VALUE` is the honest encoding of the enforced end.
 *
 * A roster rather than a rule, for the reason `SETTER_OVERRIDES_HINT` is one:
 * the class-wide version exempted eight properties whose floor was fabricated
 * rather than derived, and nothing could see the difference. Each entry names
 * the predicate, so the claim is checkable and a stale one fails below.
 *
 * One `min` slot holds one tier and it must be the more severe: a value the
 * setter refuses cannot be reported as a warning about a slider's range.
 */
const STRICTLY_POSITIVE_SETTER = new Map([
  ['AudioStreamPlayer.pitch_scale', 'audio_stream_player_internal.cpp:314'],
  ['AudioStreamPlayer2D.pitch_scale', 'audio_stream_player_internal.cpp:314'],
  ['AudioStreamPlayer3D.pitch_scale', 'audio_stream_player_internal.cpp:314'],
  ['AudioStreamPlayer2D.max_distance', 'audio_stream_player_2d.cpp:300'],
  ['CPUParticles2D.lifetime', 'cpu_particles_2d.cpp:86'],
  ['CPUParticles3D.lifetime', 'cpu_particles_3d.cpp:92'],
  ['GPUParticles2D.lifetime', 'gpu_particles_2d.cpp:78'],
  ['GPUParticles3D.lifetime', 'gpu_particles_3d.cpp:82'],
  ['CSGSphere3D.radius', 'csg_shape.cpp:1478'],
  ['LineEdit.caret_blink_interval', 'line_edit.cpp:2050'],
  ['TextEdit.caret_blink_interval', 'text_edit.cpp:5198'],
  ['Timer.wait_time', 'timer.cpp:93'],
  ['PhysicalBone3D.mass', 'physical_bone_3d.cpp:1190'],
  ['RigidBody2D.mass', 'rigid_body_2d.cpp:318'],
  ['RigidBody3D.mass', 'rigid_body_3d.cpp:334'],
  // Not an ERR_FAIL_COND but the same refusal: the setter assigns 1 and returns.
  ['Skeleton3D.motion_scale', 'skeleton_3d.cpp:586'],
  ['Window.content_scale_factor', 'window.cpp:1774'],
  // The hint's floor is 0 INCLUSIVE while the setter refuses `<= 0`, so this is
  // the one entry where MIN_VALUE is stricter than the hint rather than looser.
  ['OpenXRCompositionLayerCylinder.aspect_ratio', 'openxr_composition_layer_cylinder.cpp:144'],
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
function mismatches(label, hint, bounds) {
  const out = [];
  const { min, max } = bounds ?? {};
  // A `Number.MIN_VALUE` floor is exempt only where an entry says why. It used
  // to be exempt as a CLASS, on the reasoning that the value is never chosen
  // but spelled from an `ERR_FAIL_COND(p_x <= 0)`, so the enforced floor is the
  // real one and the band up to the hint's is a hint-only sliver. True of 18
  // properties and false of 8, and a blanket rule could not tell them apart:
  // seven had no setter guard at all and one refused at CMP_EPSILON, so the
  // floor was fabricated and the exemption hid it. Worse, it could be reached
  // by switching combinator — `v.positiveFloat` bakes the value in — so a red
  // here had a way to be silenced that was not implementing the bound.
  const exempt = STRICTLY_POSITIVE_SETTER.has(label) && min === Number.MIN_VALUE;
  if (!hint.openMin && min !== undefined && !exempt && min !== hint.lo) {
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
 *
 * It rose to 111 once the capture reached Resource classes — the subject
 * growing, not the bar dropping — and fell back to 101 when those ends, all
 * Environment ceilings, were implemented.
 *
 * 101 to 96 was not implementation either way: five ends were already coded and
 * invisible here, because three validators carried a tier without the numbers
 * beside it. `withFiniteGuard` forwarded the citation and dropped `bounds`, and
 * two hand-rolled validators never set it. `boundGrounding.test.ts` now fails on
 * that pairing, so an end cannot go missing from this ledger again by being
 * unreadable rather than unimplemented.
 *
 * 96 to 93 is implementation: `SpriteBase3D.pixel_size`'s ceiling, and the
 * `amount` and `speed_scale` ceilings CPUParticles2D had declined while its 3D
 * twin coded both from the identical hint.
 */
const UNIMPLEMENTED_HINT_ENDS = 93;

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

describe('the bound we implement against the bound Godot declared', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with a previous revision's registry.
  beforeAll(() => {
    if (stale) throw new Error(stale);
  });

  // Once for the file, not once per assertion: loading the built linter and
  // walking the capture is the whole cost here, and paying it three times took
  // the first test past vitest's 5s default under a full concurrent run.
  let rows;
  // 60s, matching the suite option above rather than the 10s hook default.
  // Loading the built barrel is the whole cost of this file, and three ledgers
  // do it at once under a full `--project scripts` run — comfortably fast
  // alone, and over the default when they contend.
  beforeAll(async () => {
    rows = await rangedProperties();
  }, 60_000);

  it('bounds no end to a number the engine does not state', () => {
    // The floor first: a comparison over an empty list is green for the wrong
    // reason, and this one depends on a build, a capture and a registry all
    // lining up.
    expect(rows.length).toBeGreaterThan(200);

    const wrong = rows
      .filter((r) => !SETTER_OVERRIDES_HINT.has(r.label))
      .flatMap((r) => mismatches(r.label, r.hint, r.bounds).map((d) => `${r.label}: ${d}`));
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
      return row === undefined || mismatches(label, row.hint, row.bounds).length === 0;
    });
    expect(dead).toEqual([]);
  });

  it('holds no strictly-positive entry for a property that no longer floors there', () => {
    // The same ratchet the override roster gets. Without it the list only ever
    // grows, and an entry that stopped describing the code would go on exempting
    // whatever replaced it — which is how the class-wide version hid eight.
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    const dead = [...STRICTLY_POSITIVE_SETTER.keys()].filter((label) => {
      const row = byLabel.get(label);
      return row === undefined || row.bounds?.min !== Number.MIN_VALUE;
    });
    expect(dead).toEqual([]);
  });

  it('cites an engine line for every strictly-positive entry', () => {
    // Same standard the bounds themselves are held to: a roster whose reasons
    // cannot be checked is a list of opinions.
    const uncited = [...STRICTLY_POSITIVE_SETTER.entries()]
      .filter(([, cite]) => !/^[\w/]+\.(cpp|h):\d+$/.test(cite))
      .map(([label, cite]) => `${label}: ${cite}`);
    expect(uncited).toEqual([]);
  });
});
