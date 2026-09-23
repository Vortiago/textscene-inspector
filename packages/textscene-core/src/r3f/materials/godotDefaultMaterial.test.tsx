/**
 * The one Godot default 3D material, and the slots that stand in for it: every
 * fallback lands on the same three numbers. Assertions read linear channels, since
 * `getHex()` re-encodes to sRGB and reports 0.6 linear as ~0xcbcbcb.
 */
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from './godotDefaultMaterial';
import { ExternalMaterialSlot } from './ExternalMaterialSlot';
import { StandardMaterialSlot } from './StandardMaterialSlot';

function linear(color: THREE.Color) {
  return color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
}

async function renderSlot(element: ReactElement) {
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <boxGeometry />
      {element}
    </mesh>
  );
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

function expectGodotDefault(material: THREE.MeshStandardMaterial) {
  const rgb = linear(material.color);
  expect(rgb.r).toBeCloseTo(0.6, 5);
  expect(rgb.g).toBeCloseTo(0.6, 5);
  expect(rgb.b).toBeCloseTo(0.6, 5);
  expect(material.roughness).toBe(0.8);
  expect(material.metalness).toBe(0.2);
}

describe('Godot default 3D material constants', () => {
  it('carries ALBEDO vec3(0.6), ROUGHNESS 0.8, METALLIC 0.2', () => {
    const rgb = linear(GODOT_DEFAULT_ALBEDO);
    expect(rgb.r).toBeCloseTo(0.6, 5);
    expect(rgb.g).toBeCloseTo(0.6, 5);
    expect(rgb.b).toBeCloseTo(0.6, 5);
    expect(GODOT_DEFAULT_ROUGHNESS).toBe(0.8);
    expect(GODOT_DEFAULT_METALLIC).toBe(0.2);
  });

  it('builds the albedo in LINEAR space, not as an sRGB hex literal', () => {
    // A plain `new THREE.Color(0x999999)` decodes as sRGB and lands near 0.318
    // linear, a little over half the shader constant.
    const asSrgbLiteral = new THREE.Color(0x999999);
    expect(linear(asSrgbLiteral).r).toBeLessThan(0.4);
    expect(linear(GODOT_DEFAULT_ALBEDO).r).toBeGreaterThan(0.5);
  });
});

describe('<ExternalMaterialSlot> fallback', () => {
  it('renders Godot’s default material when there is no external material', async () => {
    expectGodotDefault(await renderSlot(<ExternalMaterialSlot path={null} />));
  });

  it('renders Godot’s default material while a .tres has not resolved', async () => {
    expectGodotDefault(
      await renderSlot(<ExternalMaterialSlot path="res://not_yet_loaded.tres" />)
    );
  });
});

describe('<StandardMaterialSlot> fallback', () => {
  it('agrees with the shared constant for a surface with no scalars', async () => {
    expectGodotDefault(await renderSlot(<StandardMaterialSlot scalars={null} />));
  });
});
