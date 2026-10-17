import { describe, expect, it } from 'vitest';
import { GEOMETRY_INSTANCE_3D_GI_MODE_NAMES } from './geometryInstance.js';

describe('GEOMETRY_INSTANCE_3D_GI_MODE_NAMES', () => {
  it('names the GI modes without their GI_MODE_ prefix (visual_instance_3d.h:101-105)', () => {
    expect(GEOMETRY_INSTANCE_3D_GI_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' });
  });
});
