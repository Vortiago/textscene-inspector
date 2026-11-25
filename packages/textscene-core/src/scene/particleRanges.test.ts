import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';

// Each `_min` above its `_max`: the setters pull the other bound on at load (cpu_particles_2d.cpp:352-376).
const CROSSED = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Crossed" type="CPUParticles2D" parent="."]
initial_velocity_min = 200.0
initial_velocity_max = 100.0
scale_amount_min = 6.0

[node name="Spatial" type="CPUParticles3D" parent="."]
initial_velocity_max = 100.0
initial_velocity_min = 200.0
`;

function openCrossed(): Scene {
  return openScene({
    source: CROSSED,
    rootScenePath: 'res://crossed.tscn',
    provider: { loadResource: async () => null },
  });
}

// Each answer is what Godot 4.6.3 gives for the same lines (measured).
describe('a particle range the file crosses', () => {
  it('moves the bound the file writes first onto the other', async () => {
    const node = openCrossed().getNode('Crossed');
    expect(await node.get('initial_velocity_min')).toBe(100);
    expect(await node.get('initial_velocity_max')).toBe(100);
  });

  it('moves the default bound onto a lone write past it', async () => {
    const node = openCrossed().getNode('Crossed');
    expect(await node.get('scale_amount_min')).toBe(6);
    expect(await node.get('scale_amount_max')).toBe(6);
  });

  it('moves the bound the file writes first in a CPUParticles3D too', async () => {
    const node = openCrossed().getNode('Spatial');
    expect(await node.get('initial_velocity_min')).toBe(200);
    expect(await node.get('initial_velocity_max')).toBe(200);
  });
});
