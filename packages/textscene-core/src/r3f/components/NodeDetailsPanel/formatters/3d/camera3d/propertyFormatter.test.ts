import { describe, it, expect } from 'vitest';
import { formatCamera3DProperties } from './propertyFormatter';
import { sectionIn } from '../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionIn(formatCamera3DProperties, 'Camera3D', title, properties);
}

describe('formatCamera3DProperties', () => {
  it('lists the FOV and no Size for the default perspective projection', async () => {
    const camera = (await section('Camera'))!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Perspective' });
    expect(camera.items).toContainEqual({ label: 'FOV', value: '75.0°' });
    expect(camera.items.some((i) => i.label === 'Size')).toBe(false);
  });

  it('lists the Size and no FOV for an orthogonal projection', async () => {
    const camera = (await section('Camera', { projection: '1', size: '10' }))!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Orthogonal' });
    expect(camera.items).toContainEqual({ label: 'Size', value: '10.00' });
    expect(camera.items.some((i) => i.label === 'FOV')).toBe(false);
  });

  it('lists neither FOV nor Size for a frustum projection', async () => {
    const camera = (await section('Camera', { projection: '2' }))!;

    expect(camera.items).toContainEqual({ label: 'Projection', value: 'Frustum' });
    expect(camera.items.some((i) => i.label === 'FOV')).toBe(false);
    expect(camera.items.some((i) => i.label === 'Size')).toBe(false);
  });

  it('lists Near, Far and Keep Aspect', async () => {
    const camera = (await section('Camera', { near: '0.1', far: '500', keep_aspect: '0' }))!;
    expect(camera.items).toContainEqual({ label: 'Keep Aspect', value: 'Keep Width' });
    expect(camera.items).toContainEqual({ label: 'Near', value: '0.100' });
    expect(camera.items).toContainEqual({ label: 'Far', value: '500.0' });
  });

  it('names an out-of-range keep_aspect Keep Height, the mode Godot uses', async () => {
    const camera = (await section('Camera', { keep_aspect: '2' }))!;
    expect(camera.items).toContainEqual({ label: 'Keep Aspect', value: 'Keep Height' });
  });

  it('lists no Offsets section when every offset is zero', async () => {
    expect(await section('Offsets')).toBeUndefined();
  });

  it('lists only the offsets off zero', async () => {
    expect((await section('Offsets', { h_offset: '5' }))!.items).toEqual([
      { label: 'H Offset', value: '5.00' },
    ]);
  });

  it('lists every offset when all three are off zero', async () => {
    const offsets = await section('Offsets', {
      h_offset: '1.5',
      v_offset: '-2',
      frustum_offset: 'Vector2(0.5, 0.25)',
    });
    expect(offsets!.items).toEqual([
      { label: 'H Offset', value: '1.50' },
      { label: 'V Offset', value: '-2.00' },
      { label: 'Frustum Offset', value: '(0.50, 0.25)' },
    ]);
  });

  it('lists the only camera of a running scene as current, as Godot makes it, and no zero Doppler row', async () => {
    const additional = (await section('Additional'))!;

    expect(additional.items).toContainEqual({ label: 'Current', value: 'Yes' });
    expect(additional.items).toContainEqual({ label: 'Cull Mask', value: '1048575' });
    expect(additional.items.some((i) => i.label === 'Doppler Tracking')).toBe(false);
  });

  it('lists the Doppler tracking the file sets', async () => {
    const additional = (await section('Additional', { doppler_tracking: '2' }))!;
    expect(additional.items).toContainEqual({ label: 'Doppler Tracking', value: '2' });
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, -5)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Rotation (degrees)', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
