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

  it.each(['0', '1', '2', '3'])('stays silent for the previewable shape %s', (value) => {
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
    );
    expect(errorsOf(content)).toEqual([]);
  });

  it('rejects `amount = 0`, which Godot itself refuses', () => {
    const errors = errorsOf(scene('amount = 0\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('amount');
  });

  it('rejects an out-of-range explosiveness', () => {
    const errors = errorsOf(scene('explosiveness = 4.0\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('explosiveness');
  });

  it('rejects a spread beyond 180 degrees', () => {
    const errors = errorsOf(scene('spread = 400.0\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('spread');
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
});
