/**
 * A complex scene with a CPUParticles emitter needs the settle instant on the Godot side. The
 * previewer settles one `lifetime`, and a paused reference draws second zero, which shows no
 * particles (#1106).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPLEX_SCENES } from './capture-complex.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** The `lifetime` of each CPUParticles node in a scene file, Godot's default 1.0 when unset. */
function emitterLifetimes(scenePath) {
  const text = readFileSync(join(REPO_ROOT, scenePath), 'utf8');
  const nodes = text.split(/^\[node /m).slice(1);
  return nodes
    .filter((node) => /^[^\]]*type="CPUParticles3D"/.test(node))
    .map((node) => Number(/^lifetime = (\S+)$/m.exec(node)?.[1] ?? 1));
}

describe('complex scene particle instant', () => {
  const withEmitters = COMPLEX_SCENES.filter((c) => emitterLifetimes(c.godot).length > 0);

  it('covers the scenes that carry an emitter', () => {
    expect(withEmitters.map((c) => c.slug)).toEqual(['complex-truck-town-trailer', 'complex-truck-town-tow']);
  });

  it.each(withEmitters.map((c) => [c.slug, c]))('%s renders Godot at one lifetime', (_slug, scene) => {
    expect(scene.particles).toBe(emitterLifetimes(scene.godot)[0]);
  });
});
