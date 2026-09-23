/**
 * Tests for the Camera3D property formatter. The interesting branch is
 * projection-dependent: Perspective shows FOV and hides Size; Orthogonal
 * shows Size and hides FOV.
 */

import { describe, it, expect } from 'vitest';
import { formatCamera3DProperties } from './propertyFormatter';
import { parseCamera3D } from './parser';
import type { Camera3DProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): Camera3DProperties {
  return parseCamera3D(heading('Camera3D', { name: 'Cam' }), raw);
}

function section(sections: ReturnType<typeof formatCamera3DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatCamera3DProperties', () => {
  it('perspective (default projection): shows FOV, hides Size', () => {
    const sections = formatCamera3DProperties(props());
    const camera = section(sections, 'Camera')!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Perspective' });
    expect(camera.items).toContainEqual({ label: 'FOV', value: '75.0°' });
    expect(camera.items.some((i) => i.label === 'Size')).toBe(false);
  });

  it('orthogonal: shows Size, hides FOV', () => {
    const sections = formatCamera3DProperties(props({ projection: '1', size: '10' }));
    const camera = section(sections, 'Camera')!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Orthogonal' });
    expect(camera.items).toContainEqual({ label: 'Size', value: '10.00' });
    expect(camera.items.some((i) => i.label === 'FOV')).toBe(false);
  });

  it('frustum projection: hides both FOV and Size', () => {
    const sections = formatCamera3DProperties(props({ projection: '2' }));
    const camera = section(sections, 'Camera')!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Frustum' });
    expect(camera.items.some((i) => i.label === 'FOV')).toBe(false);
    expect(camera.items.some((i) => i.label === 'Size')).toBe(false);
  });

  it('formats Near/Far and Keep Aspect for every projection mode', () => {
    const camera = section(
      formatCamera3DProperties(props({ near: '0.1', far: '500', keep_aspect: '0' })),
      'Camera'
    )!;
    expect(camera.items).toContainEqual({ label: 'Keep Aspect', value: 'Keep Width' });
    expect(camera.items).toContainEqual({ label: 'Near', value: '0.100' });
    expect(camera.items).toContainEqual({ label: 'Far', value: '500.0' });
  });

  it('reports an out-of-range keep_aspect as Keep Height, the mode Godot uses', () => {
    // `camera_3d.h:50-53` declares two members, and `_update_camera_mode` treats anything that
    // is not KEEP_WIDTH as KEEP_HEIGHT. The engine has no "Disabled" mode.
    const camera = section(formatCamera3DProperties(props({ keep_aspect: '2' })), 'Camera')!;
    expect(camera.items).toContainEqual({ label: 'Keep Aspect', value: 'Keep Height' });
  });

  it('omits the Offsets section when h_offset/v_offset/frustum_offset are all zero (default)', () => {
    const sections = formatCamera3DProperties(props());
    expect(section(sections, 'Offsets')).toBeUndefined();
  });

  it('shows only the set offset fields inside the Offsets section', () => {
    const sections = formatCamera3DProperties(props({ h_offset: '5' }));
    expect(section(sections, 'Offsets')!.items).toEqual([{ label: 'H Offset', value: '5.00' }]);
  });

  it('shows the full Offsets section when h_offset, v_offset, and frustum_offset are all set', () => {
    const sections = formatCamera3DProperties(
      props({ h_offset: '1.5', v_offset: '-2', frustum_offset: 'Vector2(0.5, 0.25)' })
    );
    expect(section(sections, 'Offsets')!.items).toEqual([
      { label: 'H Offset', value: '1.50' },
      { label: 'V Offset', value: '-2.00' },
      { label: 'Frustum Offset', value: '(0.50, 0.25)' },
    ]);
  });

  it('Additional section always shows Current and Cull Mask, omits Doppler Tracking when zero', () => {
    const sections = formatCamera3DProperties(props());
    const additional = section(sections, 'Additional')!;

    expect(additional.items).toContainEqual({ label: 'Current', value: 'No' });
    expect(additional.items).toContainEqual({ label: 'Cull Mask', value: '1048575' });
    expect(additional.items.some((i) => i.label === 'Doppler Tracking')).toBe(false);
  });

  it('shows Doppler Tracking and Current: Yes when set', () => {
    const additional = section(
      formatCamera3DProperties(props({ current: 'true', doppler_tracking: '2' })),
      'Additional'
    )!;
    expect(additional.items).toContainEqual({ label: 'Current', value: 'Yes' });
    expect(additional.items).toContainEqual({ label: 'Doppler Tracking', value: '2' });
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatCamera3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, -5)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Rotation (degrees)')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
