/**
 * Unit tests for material processing helpers: path detection, reference
 * parsing, and the .tres → THREE.Material pipeline including its value
 * coercion edges (Color/Vector3 objects, boolean strings, numeric strings)
 * and texture-slot loading via the injected loader function.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  createMaterialFromContent,
  isMaterialPath,
  parseReference,
} from './materialProcessing';

describe('isMaterialPath', () => {
  it('accepts .tres paths', () => {
    expect(isMaterialPath('material.tres')).toBe(true);
    expect(isMaterialPath('res://materials/wall.tres')).toBe(true);
  });

  it('rejects other extensions', () => {
    expect(isMaterialPath('scene.tscn')).toBe(false);
    expect(isMaterialPath('texture.png')).toBe(false);
    expect(isMaterialPath('tres')).toBe(false);
    expect(isMaterialPath('')).toBe(false);
  });

  it('is case-sensitive (current contract: .TRES is not matched)', () => {
    expect(isMaterialPath('material.TRES')).toBe(false);
  });
});

describe('parseReference', () => {
  it('extracts the id from an ExtResource reference', () => {
    expect(parseReference('ExtResource("1_abc")')).toBe('1_abc');
    expect(parseReference('ExtResource("3")')).toBe('3');
  });

  it('matches an ExtResource embedded in a longer string (regex is unanchored)', () => {
    expect(parseReference('albedo_texture = ExtResource("2_tex")')).toBe('2_tex');
  });

  it('returns null for SubResource references', () => {
    expect(parseReference('SubResource("Mat_1")')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseReference('not a reference')).toBeNull();
    expect(parseReference('')).toBeNull();
    expect(parseReference('ExtResource(1_abc)')).toBeNull();
    expect(parseReference("ExtResource('1_abc')")).toBeNull();
  });

  it('returns null for an empty id (capture group requires 1+ chars)', () => {
    expect(parseReference('ExtResource("")')).toBeNull();
  });
});

describe('createMaterialFromContent', () => {
  function tres(type: string, body: string): string {
    return `[gd_resource type="${type}" format=3]\n\n[resource]\n${body}\n`;
  }

  it('creates a MeshStandardMaterial from StandardMaterial3D content', async () => {
    const material = await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_color = Color(1, 0, 0, 1)')
    );
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const std = material as THREE.MeshStandardMaterial;
    // (1, 0, 0) survives the sRGB→linear conversion exactly.
    expect(std.color.getHex()).toBe(0xff0000);
    expect(std.transparent).toBe(false);
  });

  it('maps albedo alpha < 1 to transparency', async () => {
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_color = Color(0, 1, 0, 0.5)')
    )) as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.5);
  });

  it('coerces numeric properties: metallic → metalness, roughness → roughness', async () => {
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'metallic = 0.7\nroughness = 0.25')
    )) as THREE.MeshStandardMaterial;
    expect(material.metalness).toBe(0.7);
    expect(material.roughness).toBe(0.25);
  });

  it('loads referenced textures through the injected loader', async () => {
    const texture = new THREE.Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);

    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_texture = ExtResource("1_tex")'),
      loadTexture
    )) as THREE.MeshStandardMaterial;

    expect(loadTexture).toHaveBeenCalledWith('1_tex');
    expect(material.map).toBe(texture);
  });

  it('leaves the texture slot empty when the loader returns null', async () => {
    const loadTexture = vi.fn().mockResolvedValue(null);
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_texture = ExtResource("1_tex")'),
      loadTexture
    )) as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
  });

  it('ignores texture references entirely when no loader is provided', async () => {
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_texture = ExtResource("1_tex")')
    )) as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
  });

  it('coerces boolean flags: emission/normal maps require their _enabled gates', async () => {
    const texture = new THREE.Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);

    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        [
          'emission_enabled = true',
          'emission_texture = ExtResource("1_em")',
          'normal_enabled = true',
          'normal_texture = ExtResource("2_n")',
        ].join('\n')
      ),
      loadTexture
    )) as THREE.MeshStandardMaterial;

    expect(material.emissiveMap).toBe(texture);
    expect(material.normalMap).toBe(texture);
  });

  it('drops gated textures when the _enabled flag is false', async () => {
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());
    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        'normal_enabled = false\nnormal_texture = ExtResource("2_n")'
      ),
      loadTexture
    )) as THREE.MeshStandardMaterial;
    expect(material.normalMap).toBeNull();
  });

  it('coerces uv1_scale Vector3 and applies it as a cloned-texture repeat', async () => {
    const texture = new THREE.Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);

    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        'albedo_texture = ExtResource("1_tex")\nuv1_scale = Vector3(2, 3, 1)'
      ),
      loadTexture
    )) as THREE.MeshStandardMaterial;

    // The UV transform clones the cached texture before mutating it.
    expect(material.map).not.toBe(texture);
    expect(material.map!.repeat.x).toBe(2);
    expect(material.map!.repeat.y).toBe(3);
    expect(texture.repeat.x).toBe(1);
  });

  it('falls back to a translucent standard material for ShaderMaterial', async () => {
    const material = await createMaterialFromContent(tres('ShaderMaterial', ''));
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const std = material as THREE.MeshStandardMaterial;
    expect(std.transparent).toBe(true);
    expect(std.opacity).toBe(0.5);
  });

  it('rejects unsupported material types', async () => {
    await expect(
      createMaterialFromContent(tres('ORMMaterial3D', ''))
    ).rejects.toThrow('Unsupported material type: ORMMaterial3D');
  });

  it('propagates .tres parse failures (missing header)', async () => {
    await expect(
      createMaterialFromContent('not a tres file')
    ).rejects.toThrow('Invalid .tres file');
  });
});
