/**
 * CPUParticles2D semantic rules: the two advisory warnings for settings the
 * frozen pose cannot reproduce.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n[node name="Fx" type="CPUParticles2D" parent="."]\n${body}`;
}

describe('CPUParticles2D preview rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const namesOf = (content: string) => linter.lint(content).map((d) => d.ruleName);
  const severitiesOf = (content: string, ruleName: string) =>
    linter.lint(content).filter((d) => d.ruleName === ruleName).map((d) => d.severity);

  it('says nothing about a plain, previewable emitter (happy path)', () => {
    const diagnostics = linter.lint(scene('amount = 8\nemission_shape = 1\n'));
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ['4', 'POINTS'],
    ['5', 'DIRECTED_POINTS'],
    ['6', 'RING'],
  ])('warns that emission_shape = %s (%s) draws from the global RNG', (value, label) => {
    const content = scene(`emission_shape = ${value}\n`);
    expect(namesOf(content)).toContain('cpuparticles2d-nondeterministic-emission-shape');
    expect(severitiesOf(content, 'cpuparticles2d-nondeterministic-emission-shape')).toEqual([
      'warning',
    ]);
    expect(linter.lint(content)[0]!.message).toContain(label);
  });

  it.each(['4.0', '4e0', ' 4 ', '5.9'])(
    'warns for `emission_shape = %s`, which an INT slot stores as a global-RNG shape',
    (value) => {
      // The tokenizer types `4.0`/`4e0` FLOAT (variant_parser.cpp:442-448) and
      // the write converts through `_to_int` (variant.h:369-370), truncating
      // toward zero — so `set_emission_shape` (cpu_particles_2d.cpp:480-481)
      // receives EMISSION_SHAPE_POINTS and the preview diverges exactly as it
      // does for the `4` spelling.
      expect(namesOf(scene(`emission_shape = ${value}\n`))).toContain(
        'cpuparticles2d-nondeterministic-emission-shape'
      );
    }
  );

  it('stays silent for `+4`, which Godot refuses to tokenize at all', () => {
    // `get_token` takes a leading `-` and nothing else before a digit
    // (variant_parser.cpp:420-423); a `+` reaches no branch and raises
    // "Unexpected character" (:508), so the file does not load and this rule
    // has no shape to report.
    expect(namesOf(scene('emission_shape = +4\n'))).not.toContain(
      'cpuparticles2d-nondeterministic-emission-shape'
    );
  });

  it.each(['0', '1', '2', '3', '3.9', '0e0'])('stays silent for the previewable shape %s', (value) => {
    expect(namesOf(scene(`emission_shape = ${value}\n`))).not.toContain(
      'cpuparticles2d-nondeterministic-emission-shape'
    );
  });

  it('warns when `fract_delta` is explicitly enabled', () => {
    const content = scene('fract_delta = true\n');
    expect(namesOf(content)).toContain('cpuparticles2d-fract-delta-ignored');
    expect(severitiesOf(content, 'cpuparticles2d-fract-delta-ignored')).toEqual(['warning']);
  });

  it('stays silent when `fract_delta` is omitted, though Godot defaults it TRUE', () => {
    // Warning on the default would fire for every emitter in every scene and
    // so tell the reader nothing about THIS one.
    expect(namesOf(scene('amount = 8\n'))).not.toContain('cpuparticles2d-fract-delta-ignored');
  });

  it('stays silent when `fract_delta` is explicitly disabled', () => {
    expect(namesOf(scene('fract_delta = false\n'))).not.toContain(
      'cpuparticles2d-fract-delta-ignored'
    );
  });

  it('reports both warnings together when both apply', () => {
    const names = namesOf(scene('emission_shape = 6\nfract_delta = true\n'));
    expect(names).toContain('cpuparticles2d-nondeterministic-emission-shape');
    expect(names).toContain('cpuparticles2d-fract-delta-ignored');
  });

  it('never raises an ERROR — both conditions are legal Godot (severity contract)', () => {
    const diagnostics = linter.lint(scene('emission_shape = 6\nfract_delta = true\n'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('leaves other node types alone (edge case)', () => {
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\nfract_delta = true\n`;
    expect(namesOf(content)).not.toContain('cpuparticles2d-fract-delta-ignored');
  });

  it('does not fire on an emitter with no properties at all (edge case)', () => {
    expect(linter.lint(scene(''))).toEqual([]);
  });
});

describe('CPUParticles2D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const errorsOf = (content: string) =>
    linter.lint(content).filter((d) => d.severity === 'error');

  it('passes a fully specified emitter', () => {
    const content = scene(
      [
        'emitting = true',
        'amount = 32',
        'lifetime = 1.5',
        'preprocess = 1.5',
        'speed_scale = 1.2',
        'explosiveness = 0.5',
        'randomness = 0.25',
        'use_fixed_seed = true',
        'seed = 4242',
        'lifetime_randomness = 0.1',
        'fixed_fps = 30',
        'local_coords = true',
        'draw_order = 1',
        'emission_shape = 3',
        'emission_rect_extents = Vector2(20, 5)',
        'direction = Vector2(0, -1)',
        'spread = 20.0',
        'gravity = Vector2(0, -60)',
        'initial_velocity_min = 90.0',
        'initial_velocity_max = 150.0',
        'scale_amount_curve = SubResource("1")',
        'hue_variation_min = -0.5',
        'color = Color(1, 1, 1, 1)',
        'color_ramp = SubResource("2")',
        '',
      ].join('\n')
    ).replace(
      '[node name="Root"',
      '[sub_resource type="Curve" id="1"]\n\n[sub_resource type="Gradient" id="2"]\n\n[node name="Root"'
    );
    expect(errorsOf(content)).toEqual([]);
  });

  it('rejects `amount = 0`, which Godot itself refuses', () => {
    const errors = errorsOf(scene('amount = 0\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('amount');
  });

  it('warns (not errors) on an out-of-range explosiveness', () => {
    // cpu_particles_2d.cpp:1499 hints "0,1,0.01" but set_explosiveness_ratio
    // (cpu_particles_2d.cpp:98-100) assigns unconditionally — hint-only, so
    // out of range is a warning, not an error.
    const diagnostics = linter.lint(scene('explosiveness = 4.0\n'));
    expect(errorsOf(scene('explosiveness = 4.0\n'))).toEqual([]);
    const warning = diagnostics.find((d) => d.message.includes('explosiveness'));
    expect(warning?.severity).toBe('warning');
  });

  it('warns (not errors) on a spread beyond 180 degrees', () => {
    // cpu_particles_2d.cpp:1598 hints "0,180,0.01" but set_spread
    // (cpu_particles_2d.cpp:344-348) assigns unconditionally — hint-only.
    const diagnostics = linter.lint(scene('spread = 400.0\n'));
    expect(errorsOf(scene('spread = 400.0\n'))).toEqual([]);
    const warning = diagnostics.find((d) => d.message.includes('spread'));
    expect(warning?.severity).toBe('warning');
  });

  it('rejects an emission_shape outside the enum', () => {
    const errors = errorsOf(scene('emission_shape = 9\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('emission_shape');
  });

  it('rejects a malformed gravity vector', () => {
    const errors = errorsOf(scene('gravity = Vector2(0)\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('gravity');
  });

  it('accepts the nonsense `draw_order` the Godot platformer demo ships', () => {
    // Godot's setter takes any int and reads anything but 1 as Index, so an
    // error here would fail a scene the engine opens without complaint.
    expect(errorsOf(scene('draw_order = 215832976\n'))).toEqual([]);
  });

  it('accepts a negative emission_ring_radius (cpu_particles_2d.cpp:1593 has no hint at all)', () => {
    // set_emission_ring_radius (cpu_particles_2d.cpp:531-533) assigns
    // unconditionally; the property was never bounded on the Godot side.
    expect(errorsOf(scene('emission_ring_radius = -5.0\n'))).toEqual([]);
  });

  it('accepts a negative emission_ring_inner_radius (cpu_particles_2d.cpp:1592 has no hint at all)', () => {
    expect(errorsOf(scene('emission_ring_inner_radius = -5.0\n'))).toEqual([]);
  });

  it('still rejects `amount = 0` as an error (enforced: cpu_particles_2d.cpp:67)', () => {
    const errors = errorsOf(scene('amount = 0\n'));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CPUParticles2D dangling texture', () => {
  const linter = () => new Linter();

  // `texture` is the emitter's only resource slot (cpu_particles_2d.cpp:1493).
  // The GPUParticles2D twin and the CPUParticles3D `mesh` slot both error on a
  // dangling id; this one reported nothing, so the particles rendered
  // untextured with no diagnostic.
  it('errors when texture names an id the file never declares', () => {
    const content =
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
      '[node name="Fx" type="CPUParticles2D" parent="."]\ntexture = ExtResource("999")\n';
    const found = linter()
      .lint(content)
      .filter((d) => d.ruleName === 'dangling-resource-reference');
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('error');
  });

  it('says nothing when the referenced texture is declared', () => {
    const content =
      '[gd_scene load_steps=2 format=3]\n\n' +
      '[ext_resource type="Texture2D" path="res://p.png" id="1_tex"]\n\n' +
      '[node name="Root" type="Node2D"]\n\n' +
      '[node name="Fx" type="CPUParticles2D" parent="."]\ntexture = ExtResource("1_tex")\n';
    expect(
      linter()
        .lint(content)
        .filter((d) => d.ruleName === 'dangling-resource-reference')
    ).toEqual([]);
  });

  // Absence is Godot's default form: an emitter with no texture draws a plain
  // point sprite, so there is nothing to report.
  it('says nothing when the slot is absent or explicitly cleared', () => {
    const bare =
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
      '[node name="Fx" type="CPUParticles2D" parent="."]\namount = 8\n';
    const cleared =
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
      '[node name="Fx" type="CPUParticles2D" parent="."]\ntexture = null\n';
    for (const content of [bare, cleared]) {
      expect(
        linter()
          .lint(content)
          .filter((d) => d.ruleName === 'dangling-resource-reference')
      ).toEqual([]);
    }
  });
});
