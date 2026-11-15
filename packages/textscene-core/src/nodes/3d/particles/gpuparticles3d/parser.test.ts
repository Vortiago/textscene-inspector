import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { GPU_PARTICLES_DEFAULT_VISIBILITY_AABB } from '../../../../godot/scene/gpuParticles';
import { parseGPUParticles3D } from './parser';

const parse = (properties: Record<string, string>) =>
  parseGPUParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), properties);

describe('parseGPUParticles3D', () => {
  it('reads visibility_aabb as the emitter box', () => {
    expect(parse({ visibility_aabb: 'AABB(-1, -2, -3, 2, 4, 6)' }).visibilityAabb).toEqual({
      position: { x: -1, y: -2, z: -3 },
      size: { x: 2, y: 4, z: 6 },
    });
  });

  it("keeps the constructor's box for an emitter that authors none", () => {
    expect(parse({}).visibilityAabb).toBe(GPU_PARTICLES_DEFAULT_VISIBILITY_AABB);
  });

  it("keeps the constructor's box for a malformed visibility_aabb (error case)", () => {
    expect(parse({ visibility_aabb: 'AABB(bad)' }).visibilityAabb).toBe(
      GPU_PARTICLES_DEFAULT_VISIBILITY_AABB
    );
  });

  it('keeps an authored AABB() empty, as the particles hold it (edge case)', () => {
    expect(parse({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)' }).visibilityAabb.size).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it('keeps the process_material reference raw, for the gizmo to resolve', () => {
    expect(parse({ process_material: 'SubResource("Process_1")' }).processMaterial).toBe(
      'SubResource("Process_1")'
    );
  });

  it('has no process material for an emitter that authors none', () => {
    expect(parse({}).processMaterial).toBeUndefined();
  });

  it('reads the emitter as the node constructor sets it (`gpu_particles_3d.cpp:878-904`)', () => {
    expect(parse({}).emitter).toEqual({
      emitting: true,
      amount: 8,
      amountRatio: 1,
      lifetime: 1,
      oneShot: false,
      preprocess: 0,
      explosiveness: 0,
      randomness: 0,
      fixedFps: 30,
      fractDelta: true,
      localCoords: false,
      useFixedSeed: false,
      seed: 0,
    });
  });

  it('reads the emitter keys', () => {
    expect(
      parse({
        emitting: 'false',
        amount: '3',
        amount_ratio: '0.5',
        lifetime: '2.5',
        one_shot: 'true',
        preprocess: '1.2',
        explosiveness: '1',
        randomness: '0.25',
        fixed_fps: '24',
        fract_delta: 'false',
        local_coords: 'true',
        use_fixed_seed: 'true',
        seed: '12345',
        speed_scale: '2',
      }).emitter
    ).toEqual({
      emitting: false,
      amount: 3,
      amountRatio: 0.5,
      lifetime: 2.5,
      oneShot: true,
      preprocess: 1.2,
      explosiveness: 1,
      randomness: 0.25,
      fixedFps: 24,
      fractDelta: false,
      localCoords: true,
      useFixedSeed: true,
      seed: 12345,
    });
  });

  it('keeps the default for an amount or a lifetime the setter refuses (error case)', () => {
    const { emitter } = parse({ amount: '0', lifetime: '0' });
    expect(emitter).toMatchObject({ amount: 8, lifetime: 1 });
  });

  it('reads the seed as the uint32 the setter takes (edge case)', () => {
    expect(parse({ seed: '4294967295' }).emitter.seed).toBe(4294967295);
  });

  it('draws one pass by default, and the passes up to draw_passes', () => {
    expect(parse({ draw_pass_1: 'SubResource("m")' }).drawPasses).toEqual(['SubResource("m")']);
    expect(
      parse({
        draw_passes: '3',
        draw_pass_1: 'SubResource("a")',
        draw_pass_3: 'SubResource("c")',
        draw_pass_4: 'SubResource("d")',
      }).drawPasses
    ).toEqual(['SubResource("a")', undefined, 'SubResource("c")']);
  });

  it('keeps at most the four passes the node declares (edge case)', () => {
    expect(parse({ draw_passes: '9' }).drawPasses).toHaveLength(4);
  });

  it('draws in index order and aligns nothing by default', () => {
    const { drawOrder, transformAlign } = parse({});
    expect([drawOrder, transformAlign]).toEqual([0, 0]);
  });

  it('reads draw_order and transform_align', () => {
    const { drawOrder, transformAlign } = parse({ draw_order: '3', transform_align: '2' });
    expect([drawOrder, transformAlign]).toEqual([3, 2]);
  });

  it('keeps a draw_order no order names, which the copy shader draws in index order (edge case)', () => {
    expect(parse({ draw_order: '7' }).drawOrder).toBe(7);
  });

  it('keeps DISABLED for the LOCAL_BILLBOARD that 4.6.3 refuses (edge case)', () => {
    expect(parse({ transform_align: '4' }).transformAlign).toBe(0);
  });

  it("keeps the constructor's trail: off, 0.3 seconds, no skin", () => {
    const { trailEnabled, trailLifetime, drawSkin } = parse({});
    expect([trailEnabled, trailLifetime, drawSkin]).toEqual([false, 0.3, undefined]);
  });

  it('reads trail_enabled, trail_lifetime and the draw_skin reference', () => {
    const { trailEnabled, trailLifetime, drawSkin } = parse({
      trail_enabled: 'true',
      trail_lifetime: '0.5',
      draw_skin: 'SubResource("Skin_1")',
    });
    expect([trailEnabled, trailLifetime, drawSkin]).toEqual([true, 0.5, 'SubResource("Skin_1")']);
  });

  it('keeps 0.3 for a trail_lifetime the setter refuses (edge case)', () => {
    expect(parse({ trail_lifetime: '0.005' }).trailLifetime).toBe(0.3);
  });
});
