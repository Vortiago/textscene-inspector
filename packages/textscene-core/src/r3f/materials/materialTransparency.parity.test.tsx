/**
 * Parity: StandardMaterial3D transparency mode and shading_mode. DISABLED ignores
 * albedo alpha, ALPHA blends with depthWrite off, ALPHA_SCISSOR cuts out through
 * alphaTest with depthWrite on, and UNSHADED is flat MeshBasic albedo. No material
 * is Godot's default surface.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { StandardMaterialSlot } from './StandardMaterialSlot';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';

async function matFor(scalars: StandardMaterial3DScalars | null): Promise<THREE.Material> {
  const r = await ReactThreeTestRenderer.create(
    <mesh>
      <StandardMaterialSlot scalars={scalars} />
    </mesh>
  );
  return (r.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
}

describe('transparency-mode + shading_mode scalar parity', () => {
  it('mode 2 (ALPHA_SCISSOR): alphaTest set (default 0.5), not transparent', () => {
    const s = parseStandardMaterial3DScalars({ transparency: '2' });
    expect(s.alphaTest).toBeCloseTo(0.5, 5);
    expect(s.transparent).toBe(false);
    expect(s.depthWrite).toBe(true);
  });

  it('mode 2 honors alpha_scissor_threshold', () => {
    const s = parseStandardMaterial3DScalars({ transparency: '2', alpha_scissor_threshold: '0.3' });
    expect(s.alphaTest).toBeCloseTo(0.3, 5);
  });

  it('mode 1 (ALPHA): transparent + depthWrite OFF', () => {
    const s = parseStandardMaterial3DScalars({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(s.transparent).toBe(true);
    expect(s.depthWrite).toBe(false);
  });

  it('mode 0 (default): albedo alpha < 1 does NOT force transparency; depthWrite ON', () => {
    const s = parseStandardMaterial3DScalars({ albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(s.transparent).toBe(false);
    expect(s.depthWrite).toBe(true);
  });

  it('shading_mode=0 → unshaded; absent → per_pixel', () => {
    expect(parseStandardMaterial3DScalars({ shading_mode: '0' }).shadingMode).toBe('unshaded');
    expect(parseStandardMaterial3DScalars({}).shadingMode).toBe('per_pixel');
  });
});

describe('StandardMaterialSlot parity rendering', () => {
  it('unshaded scalars render a MeshBasicMaterial (unlit)', async () => {
    const m = await matFor(parseStandardMaterial3DScalars({ shading_mode: '0' }));
    expect(m.type).toBe('MeshBasicMaterial');
  });

  it('per-pixel scalars render a MeshStandardMaterial', async () => {
    const m = await matFor(parseStandardMaterial3DScalars({}));
    expect(m.type).toBe('MeshStandardMaterial');
  });

  it('no-material placeholder is Godot’s default material shader, not a default StandardMaterial3D', async () => {
    const m = (await matFor(null)) as THREE.MeshStandardMaterial;
    // scene_shader_forward_clustered.cpp: ALBEDO = vec3(0.6), ROUGHNESS = 0.8,
    // METALLIC = 0.2. ALBEDO is a shader constant, so 0.6 is linear, and it is
    // asserted in that space rather than as its sRGB hex string.
    const linear = m.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
    expect(linear.r).toBeCloseTo(0.6, 5);
    expect(linear.g).toBeCloseTo(0.6, 5);
    expect(linear.b).toBeCloseTo(0.6, 5);
    expect(m.metalness).toBe(0.2);
    expect(m.roughness).toBe(0.8);
  });

  it('ALPHA_SCISSOR material writes depth + has alphaTest', async () => {
    const m = await matFor(parseStandardMaterial3DScalars({ transparency: '2' }));
    expect(m.alphaTest).toBeCloseTo(0.5, 5);
    expect(m.depthWrite).toBe(true);
    expect(m.transparent).toBe(false);
  });

  it('ALPHA material does not write depth', async () => {
    const m = await matFor(parseStandardMaterial3DScalars({ transparency: '1', albedo_color: 'Color(1,1,1,0.5)' }));
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
  });
});
