/**
 * GPUParticles2D semantic rule: the missing-process_material advisory.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

function scene(body: string): string {
  return `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n[node name="Fx" type="GPUParticles2D" parent="."]\n${body}`;
}

describe('GPUParticles2D missing-process-material rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  const namesOf = (content: string) => linter.lint(content).map((d) => d.ruleName);
  const severitiesOf = (content: string, ruleName: string) =>
    linter.lint(content).filter((d) => d.ruleName === ruleName).map((d) => d.severity);

  it('warns when process_material is absent (happy path for the rule)', () => {
    const content = scene('amount = 8\n');
    expect(namesOf(content)).toContain('gpuparticles2d-missing-process-material');
    expect(severitiesOf(content, 'gpuparticles2d-missing-process-material')).toEqual(['warning']);
  });

  it('stays silent when process_material is a SubResource reference', () => {
    const content = `[gd_scene format=3]\n\n[sub_resource type="ParticleProcessMaterial" id="Process_1"]\n\n[node name="Fx" type="GPUParticles2D"]\nprocess_material = SubResource("Process_1")\n`;
    expect(namesOf(content)).not.toContain('gpuparticles2d-missing-process-material');
  });

  it('stays silent when process_material is an ExtResource reference', () => {
    const content = `[gd_scene format=3]\n\n[ext_resource type="ParticleProcessMaterial" path="res://fx.tres" id="1"]\n\n[node name="Fx" type="GPUParticles2D"]\nprocess_material = ExtResource("1")\n`;
    expect(namesOf(content)).not.toContain('gpuparticles2d-missing-process-material');
  });

  it('never raises an ERROR — a missing process_material is legal Godot (severity contract)', () => {
    const diagnostics = linter.lint(scene(''));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('leaves other node types alone (edge case)', () => {
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n`;
    expect(namesOf(content)).not.toContain('gpuparticles2d-missing-process-material');
  });

  it('fires exactly once on an emitter with no properties at all (edge case)', () => {
    const names = namesOf(scene(''));
    expect(names.filter((n) => n === 'gpuparticles2d-missing-process-material')).toHaveLength(1);
  });
});
