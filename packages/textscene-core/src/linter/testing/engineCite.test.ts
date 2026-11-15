import { describe, expect, it } from 'vitest';
import { citesItsSource } from './engineCite';

describe('citesItsSource', () => {
  it('takes a file:line for either tier', () => {
    expect(citesItsSource({ kind: 'enforced', cite: 'camera_3d.cpp:725' })).toBe(true);
    expect(citesItsSource({ kind: 'hinted', cite: 'camera_3d.cpp:685' })).toBe(true);
  });

  it('takes the capture for a hint bound, which a derived check reads from it', () => {
    expect(citesItsSource({ kind: 'hinted', cite: 'ClassDB 4.6.3: Camera3D.near' })).toBe(true);
  });

  it('refuses the capture alone for a setter fact, which only the source states', () => {
    expect(citesItsSource({ kind: 'enforced', cite: 'ClassDB 4.6.3: Camera3D.fov' })).toBe(false);
  });

  it('takes a setter cite beside a capture cite, as one end of each', () => {
    expect(
      citesItsSource({ kind: 'enforced', cite: 'camera_3d.cpp:731, ClassDB 4.6.3: Camera3D.size' })
    ).toBe(true);
  });

  it('refuses a cite that names no location', () => {
    expect(citesItsSource({ kind: 'hinted', cite: 'the class reference' })).toBe(false);
    expect(citesItsSource({ kind: 'hinted', cite: 'ClassDB: Camera3D.near' })).toBe(false);
  });
});
