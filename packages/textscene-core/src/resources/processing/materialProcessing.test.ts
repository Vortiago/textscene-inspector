/**
 * Unit tests for material processing helpers: path detection and the .tres →
 * THREE.Material pipeline, including its raw-string value decoding edges
 * (Color/Vector3, booleans, numbers) and texture-slot loading via the
 * injected loader function, resolved against the file's own [ext_resource]
 * headers.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../logger';
import { createMaterialFromContent, isMaterialPath } from './materialProcessing';

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

describe('createMaterialFromContent', () => {
  function tres(type: string, body: string, extResourceLines = ''): string {
    return `[gd_resource type="${type}" format=3]\n\n${extResourceLines}[resource]\n${body}\n`;
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

  it('loads referenced textures through the injected loader, resolved to a res:// path', async () => {
    const texture = new THREE.Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);

    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        'albedo_texture = ExtResource("1_tex")',
        '[ext_resource type="Texture2D" path="res://textures/albedo.png" id="1_tex"]\n'
      ),
      loadTexture
    )) as THREE.MeshStandardMaterial;

    expect(loadTexture).toHaveBeenCalledWith('res://textures/albedo.png');
    expect(material.map).toBe(texture);
  });

  it('skips loading a texture whose ExtResource id has no matching ext_resource header', async () => {
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());

    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_texture = ExtResource("dangling")'),
      loadTexture
    )) as THREE.MeshStandardMaterial;

    expect(loadTexture).not.toHaveBeenCalled();
    expect(material.map).toBeNull();
  });

  it('leaves the texture slot empty when the loader returns null', async () => {
    const loadTexture = vi.fn().mockResolvedValue(null);
    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        'albedo_texture = ExtResource("1_tex")',
        '[ext_resource type="Texture2D" path="res://textures/albedo.png" id="1_tex"]\n'
      ),
      loadTexture
    )) as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
  });

  it('ignores texture references entirely when no loader is provided', async () => {
    const material = (await createMaterialFromContent(
      tres(
        'StandardMaterial3D',
        'albedo_texture = ExtResource("1_tex")',
        '[ext_resource type="Texture2D" path="res://textures/albedo.png" id="1_tex"]\n'
      )
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
        ].join('\n'),
        [
          '[ext_resource type="Texture2D" path="res://textures/emission.png" id="1_em"]',
          '[ext_resource type="Texture2D" path="res://textures/normal.png" id="2_n"]',
          '',
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
        'normal_enabled = false\nnormal_texture = ExtResource("2_n")',
        '[ext_resource type="Texture2D" path="res://textures/normal.png" id="2_n"]\n'
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
        'albedo_texture = ExtResource("1_tex")\nuv1_scale = Vector3(2, 3, 1)',
        '[ext_resource type="Texture2D" path="res://textures/albedo.png" id="1_tex"]\n'
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

  it('warns and returns a default StandardMaterial3D for a header-only .tres (no [resource] section)', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const material = await createMaterialFromContent(
        '[gd_resource type="StandardMaterial3D" format=3]\n'
      );
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no [resource] section')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('recognizes an indented [resource] heading (scanning loop trims lines)', async () => {
    const material = (await createMaterialFromContent(
      '[gd_resource type="StandardMaterial3D" format=3]\n\n  [resource]\nalbedo_color = Color(1, 0, 0, 1)\n'
    )) as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0xff0000);
  });

  it('propagates .tres parse failures (missing header)', async () => {
    await expect(
      createMaterialFromContent('not a tres file')
    ).rejects.toThrow('Invalid .tres file');
  });
});

/**
 * A material declared as a `[sub_resource]` of a mesh's own `.tres` — the third
 * kind of reference. The file's `[gd_resource type=…]` is then an ArrayMesh, so
 * the switch has to follow the SUB-RESOURCE's type, and the sub-resource's own
 * texture ExtResources resolve against that file's ext_resource table.
 */
describe('createMaterialFromContent for a sub-resource', () => {
  /** Shaped like scenes/demos/3d/truck_town/vehicles/meshes/wheel.tres. */
  const MESH_TRES = [
    '[gd_resource type="ArrayMesh" format=4 uid="uid://bqrwin8ccgptt"]',
    '',
    '[ext_resource type="Texture2D" path="res://vehicles/tire_albedo.png" id="1_tex"]',
    '',
    '[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_shvqh"]',
    'resource_name = "tire"',
    'albedo_color = Color(1, 0, 0, 1)',
    'roughness = 0.8',
    '',
    '[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_020iw"]',
    'resource_name = "chrome"',
    'metallic = 1.0',
    'roughness = 0.35',
    '',
    '[resource]',
    'resource_name = "meshes_wheel"',
    '_surfaces = []',
    '',
  ].join('\n');

  it('builds the named sub-resource rather than the file’s own [resource] body', async () => {
    const material = (await createMaterialFromContent(
      MESH_TRES,
      undefined,
      'StandardMaterial3D_shvqh'
    )) as THREE.MeshStandardMaterial;

    expect(material.color.getHex()).toBe(0xff0000);
    expect(material.roughness).toBe(0.8);
  });

  it('tells two sub-resources of the same file apart', async () => {
    const chrome = (await createMaterialFromContent(
      MESH_TRES,
      undefined,
      'StandardMaterial3D_020iw'
    )) as THREE.MeshStandardMaterial;

    expect(chrome.metalness).toBe(1);
    expect(chrome.roughness).toBe(0.35);
  });

  it('resolves its texture ExtResources against the owning file’s table', async () => {
    const texture = new THREE.Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);
    const textured = MESH_TRES.replace(
      'roughness = 0.8',
      'roughness = 0.8\nalbedo_texture = ExtResource("1_tex")'
    );

    const material = (await createMaterialFromContent(
      textured,
      loadTexture,
      'StandardMaterial3D_shvqh'
    )) as THREE.MeshStandardMaterial;

    expect(loadTexture).toHaveBeenCalledWith('res://vehicles/tire_albedo.png');
    expect(material.map).toBe(texture);
  });

  it('rejects an id the file does not declare', async () => {
    await expect(
      createMaterialFromContent(MESH_TRES, undefined, 'StandardMaterial3D_absent')
    ).rejects.toThrow('Sub-resource "StandardMaterial3D_absent" is not declared');
  });
});
