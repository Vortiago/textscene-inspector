import { describe, expect, it } from 'vitest';
import {
  GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_RESOLUTION_NAMES,
  GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_UPDATE_MODE_NAMES,
  GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_NAMES,
} from './particlesCollision3d.js';

describe('GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_NAMES', () => {
  it('names the six texel counts and leaves out RESOLUTION_MAX (gpu_particles_collision_3d.h:99-107)', () => {
    expect(GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_NAMES).toEqual({
      0: '16',
      1: '32',
      2: '64',
      3: '128',
      4: '256',
      5: '512',
    });
  });
});

describe('GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_RESOLUTION_NAMES', () => {
  it('names the six texel counts and leaves out RESOLUTION_MAX (gpu_particles_collision_3d.h:211-219)', () => {
    expect(GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_RESOLUTION_NAMES).toEqual({
      0: '256',
      1: '512',
      2: '1024',
      3: '2048',
      4: '4096',
      5: '8192',
    });
  });
});

describe('GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_UPDATE_MODE_NAMES', () => {
  it('names the two update modes without their UPDATE_MODE_ prefix (gpu_particles_collision_3d.h:221-224)', () => {
    expect(GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_UPDATE_MODE_NAMES).toEqual({
      0: 'WHEN_MOVED',
      1: 'ALWAYS',
    });
  });
});
