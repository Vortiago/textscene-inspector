import { describe, expect, it } from 'vitest';
import { decodeProcessSimulation } from './simulation';

describe('decodeProcessSimulation', () => {
  it('reads an empty material as Godot constructs it (`particle_process_material.cpp:2374-2427`)', () => {
    expect(decodeProcessSimulation({})).toEqual({
      direction: { x: 1, y: 0, z: 0 },
      spread: 45,
      flatness: 0,
      initialVelocity: { min: 0, max: 0 },
      linearAccel: { min: 0, max: 0 },
      radialAccel: { min: 0, max: 0 },
      tangentialAccel: { min: 0, max: 0 },
      scale: { min: 1, max: 1 },
      gravity: { x: 0, y: Math.fround(-9.8), z: 0 },
      lifetimeRandomness: 0,
      color: { r: 1, g: 1, b: 1, a: 1 },
    });
  });

  it('reads the min and max of each parameter', () => {
    const simulation = decodeProcessSimulation({
      initial_velocity_min: '2',
      initial_velocity_max: '3',
      linear_accel_min: '-1',
      radial_accel_max: '4',
      tangential_accel_min: '5',
      scale_min: '0.5',
      scale_max: '2',
    });
    expect(simulation).toMatchObject({
      initialVelocity: { min: 2, max: 3 },
      linearAccel: { min: -1, max: 0 },
      radialAccel: { min: 0, max: 4 },
      tangentialAccel: { min: 5, max: 0 },
      scale: { min: 0.5, max: 2 },
    });
  });

  it('reads the direction, spread, flatness, gravity and lifetime randomness', () => {
    expect(
      decodeProcessSimulation({
        direction: 'Vector3(0, 1, 0)',
        spread: '10',
        flatness: '0.5',
        gravity: 'Vector3(0, -2, 0)',
        lifetime_randomness: '0.25',
      })
    ).toMatchObject({
      direction: { x: 0, y: 1, z: 0 },
      spread: 10,
      flatness: 0.5,
      gravity: { x: 0, y: -2, z: 0 },
      lifetimeRandomness: 0.25,
    });
  });

  it('converts the colour from sRGB to linear light, and keeps alpha (`particle_process_material.cpp:309`)', () => {
    const { color } = decodeProcessSimulation({ color: 'Color(0.25, 0.25, 0.25, 0.5)' });
    expect(color.r).toBeCloseTo(0.0509, 4);
    expect(color.g).toBeCloseTo(0.0509, 4);
    expect(color.b).toBeCloseTo(0.0509, 4);
    expect(color.a).toBe(0.5);
  });
});
