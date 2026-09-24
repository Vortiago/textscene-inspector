/**
 * AreaLight3D `area_normalize_energy`, true by default: Godot divides the colour
 * by `area_size.x × area_size.y`, so resizing does not change the output. A
 * RectAreaLight intensity is a luminance, so the same division keeps a
 * 4 × 0.05 strip as bright as a 1 × 1 panel.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AreaLight3D } from './Component';
import { parseAreaLight3D } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { name: 'Area', type: 'AreaLight3D' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Area', type: 'AreaLight3D', children: [], properties: parseAreaLight3D(heading, raw) };
}

async function intensityOf(raw: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(<AreaLight3D node={node(raw)} />);
  const light = renderer.scene.findByType('RectAreaLight').instance as THREE.RectAreaLight;
  return light.intensity;
}

describe('<AreaLight3D> energy normalisation', () => {
  it('divides intensity by the rectangle area when normalising (the default)', async () => {
    const unit = await intensityOf({ light_energy: '1.0', area_size: 'Vector2(1, 1)' });
    const strip = await intensityOf({ light_energy: '1.0', area_size: 'Vector2(4, 0.05)' });

    // area 0.2 → 5× the luminance of the unit panel for the same total output.
    expect(strip).toBeCloseTo(unit * 5, 5);
  });

  it('leaves intensity alone when normalisation is explicitly off', async () => {
    const off = await intensityOf({
      light_energy: '1.0',
      area_size: 'Vector2(4, 0.05)',
      area_normalize_energy: 'false',
    });
    const unit = await intensityOf({
      light_energy: '1.0',
      area_size: 'Vector2(1, 1)',
      area_normalize_energy: 'false',
    });

    expect(off).toBeCloseTo(unit, 5);
  });

  it('keeps a normalised light at constant output across sizes', async () => {
    const small = await intensityOf({ light_energy: '2.0', area_size: 'Vector2(0.5, 0.5)' });
    const large = await intensityOf({ light_energy: '2.0', area_size: 'Vector2(2, 2)' });

    // intensity × area is the total output, equal on both.
    expect(small * 0.25).toBeCloseTo(large * 4, 5);
  });

  it('parses area_normalize_energy defaulting to true, and area_range to Godot 5', () => {
    const props = parseAreaLight3D(heading, {});
    expect(props.area_normalize_energy).toBe(true);
    expect(props.area_range).toBe(5);
    expect(parseAreaLight3D(heading, { area_normalize_energy: 'false' }).area_normalize_energy).toBe(
      false
    );
  });
});
