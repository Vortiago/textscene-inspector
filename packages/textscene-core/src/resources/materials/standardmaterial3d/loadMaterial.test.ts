/**
 * The `.tres` arrival path: path detection, section selection (whole-file body
 * vs a named `[sub_resource]`), the ShaderMaterial and header-only fallbacks,
 * and texture-slot loading through the injected loader, resolved against the
 * owning file's own `[ext_resource]` headers.
 *
 * Property DECODING is not tested here — it belongs to `decode.ts`, and
 * `arrivalParity.test.ts` proves this path and the inline one share it.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../../logger';
import { resolveGradientTexture2D } from '../../textures/gradienttexture2d/resolveGradientTexture';
import {
  createMaterialFromContent,
  isMaterialPath,
  releaseProceduralTextures,
} from './loadMaterial';

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

  it('leaves albedo alpha < 1 OPAQUE, as Godot does with transparency disabled', async () => {
    // This path used to force `transparent = true` from the alpha channel; the
    // inline path never did. Godot emits `ALPHA *= albedo.a * albedo_tex.a`
    // only when `transparency != TRANSPARENCY_DISABLED`, so the alpha is inert
    // here — the divergence that rendered a shipped tree and glass wrongly.
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'albedo_color = Color(0, 1, 0, 0.5)')
    )) as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(0.5);
  });

  it('blends once the material actually declares a transparency mode', async () => {
    const material = (await createMaterialFromContent(
      tres('StandardMaterial3D', 'transparency = 1\nalbedo_color = Color(0, 1, 0, 0.5)')
    )) as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.5);
    expect(material.depthWrite).toBe(false);
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

describe('createMaterialFromContent texture-slot resolution', () => {
  it('does not ask for a slot whose feature flag is off', async () => {
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());
    await createMaterialFromContent(
      [
        '[gd_resource type="StandardMaterial3D" format=3]',
        '[ext_resource type="Texture2D" path="res://n.png" id="1_n"]',
        '[resource]',
        'normal_texture = ExtResource("1_n")',
        '',
      ].join('\n'),
      loadTexture
    );
    // Godot never samples an unflagged normal map, so fetching the image would
    // be a load — and a possible missing-resources row — for nothing.
    expect(loadTexture).not.toHaveBeenCalled();
  });

  it('skips a SubResource naming a type with no rasteriser', async () => {
    // `ice.tres` / `lava.tres` point their albedo at a NoiseTexture2D declared
    // in the same file. Nothing rasterises those yet, so the slot stays empty —
    // and no file is fetched for a reference that names no file.
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());
    const material = (await createMaterialFromContent(
      [
        '[gd_resource type="StandardMaterial3D" format=3]',
        '[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_a"]',
        'width = 64',
        '[resource]',
        'albedo_texture = SubResource("NoiseTexture2D_a")',
        '',
      ].join('\n'),
      loadTexture
    )) as THREE.MeshStandardMaterial;
    expect(loadTexture).not.toHaveBeenCalled();
    expect(material.map).toBeNull();
  });

  it('does not fetch an anisotropy_flowmap it cannot repack', async () => {
    // Godot stores the per-pixel anisotropy strength in ALPHA and three reads it
    // from BLUE; the repack lives in the node layer, so this path applies the
    // anisotropy SCALARS and leaves the map alone rather than sampling garbage.
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());
    const material = (await createMaterialFromContent(
      [
        '[gd_resource type="StandardMaterial3D" format=3]',
        '[ext_resource type="Texture2D" path="res://flow.png" id="1_f"]',
        '[resource]',
        'anisotropy_enabled = true',
        'anisotropy = 0.8',
        'anisotropy_flowmap = ExtResource("1_f")',
        '',
      ].join('\n'),
      loadTexture
    )) as THREE.MeshPhysicalMaterial;
    expect(loadTexture).not.toHaveBeenCalled();
    expect(material.anisotropy).toBeCloseTo(0.8, 5);
    expect(material.anisotropyMap).toBeNull();
  });
});

/**
 * A material `.tres` that carries its OWN gradient: the albedo names a
 * `[sub_resource type="GradientTexture2D"]` beside the `[resource]` body, and
 * that texture is described entirely by the file — the gradient block is in
 * there too. Nothing to fetch, so it rasterises synchronously, against the
 * MATERIAL FILE's table rather than any scene's.
 *
 * The lifetime half is the load-bearing part. The rasterised texture is BORROWED
 * from a shared, capacity-bounded cache, and this path is imperative: no
 * component mounts, so nothing holds the React pin that a scene's inline
 * gradient gets from `useProceduralTexturePins`. Without a pin taken here, the
 * 65th distinct gradient evicts and DISPOSES one a cached material is still
 * sampling, and nothing re-rasterises because nothing changed.
 */
describe('createMaterialFromContent with a procedural texture in its own .tres', () => {
  const GRADIENT_MATERIAL = [
    '[gd_resource type="StandardMaterial3D" load_steps=3 format=3]',
    '',
    '[sub_resource type="Gradient" id="Gradient_cd1ha"]',
    'interpolation_mode = 2',
    'offsets = PackedFloat32Array(0, 0.642276, 1)',
    'colors = PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    '',
    '[sub_resource type="GradientTexture2D" id="GradientTexture2D_qhu5r"]',
    'gradient = SubResource("Gradient_cd1ha")',
    'fill = 1',
    'fill_from = Vector2(0.5, 0.5)',
    'fill_to = Vector2(0.5, 0.01)',
    '',
    '[resource]',
    'albedo_texture = SubResource("GradientTexture2D_qhu5r")',
    'roughness = 0.4',
    '',
  ].join('\n');

  it('builds with the rasterised gradient on the albedo slot', async () => {
    const loadTexture = vi.fn().mockResolvedValue(new THREE.Texture());
    const material = (await createMaterialFromContent(
      GRADIENT_MATERIAL,
      loadTexture
    )) as THREE.MeshStandardMaterial;

    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect((material.map!.image as { width: number }).width).toBe(64);
    expect(material.roughness).toBe(0.4);
    // Synchronous: a gradient names no file, so the loader is never asked.
    expect(loadTexture).not.toHaveBeenCalled();
  });

  it('builds it with no texture loader at all', async () => {
    // The async arm is what needs a loader; a self-describing texture does not.
    const material = (await createMaterialFromContent(
      GRADIENT_MATERIAL
    )) as THREE.MeshStandardMaterial;
    expect(material.map).toBeInstanceOf(THREE.DataTexture);
  });

  it('pins the borrowed texture, and survives an eviction wave', async () => {
    const material = (await createMaterialFromContent(
      GRADIENT_MATERIAL
    )) as THREE.MeshStandardMaterial;
    const borrowed = material.map as THREE.DataTexture;
    const disposed = vi.fn();
    borrowed.addEventListener('dispose', disposed);

    // Push far past the cache's capacity with unrelated gradients. An unpinned
    // entry would be evicted and disposed somewhere in here.
    for (let i = 0; i < 200; i++) {
      resolveGradientTexture2D('SubResource("GradientTexture2D_qhu5r")', [
        {
          id: 'Gradient_x',
          type: 'Gradient',
          data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' },
        },
        {
          id: 'GradientTexture2D_qhu5r',
          type: 'GradientTexture2D',
          data: { gradient: 'SubResource("Gradient_x")', width: '8', height: '8' },
        },
      ]);
    }

    expect(disposed).not.toHaveBeenCalled();
    expect((borrowed.image.data as Uint8Array).length).toBeGreaterThan(0);
  });

  it('releases the pin when the material is disposed', async () => {
    const material = (await createMaterialFromContent(GRADIENT_MATERIAL));
    expect(material.userData['textsceneProceduralKeys']).toHaveLength(1);

    releaseProceduralTextures(material);

    // The record is gone, so a second dispose cannot double-unpin a key the
    // cache may since have lent to somebody else.
    expect(material.userData['textsceneProceduralKeys']).toBeUndefined();
    releaseProceduralTextures(material);
  });

  it('records no keys for a material that borrowed nothing', async () => {
    const material = await createMaterialFromContent(
      '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nroughness = 0.5\n'
    );
    expect(material.userData['textsceneProceduralKeys']).toBeUndefined();
    releaseProceduralTextures(material);
  });
});
