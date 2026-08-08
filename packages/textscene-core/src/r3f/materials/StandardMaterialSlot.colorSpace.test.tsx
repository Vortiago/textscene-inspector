/**
 * Which of a StandardMaterial3D's texture slots decode sRGB, and which sample
 * raw bytes.
 *
 * Godot's own answer is written into the shader BaseMaterial3D generates:
 * exactly three samplers carry the `source_color` hint, which is what makes
 * the renderer bind a texture's sRGB-typed GPU view and decode before every
 * sample —
 *
 *   scene/resources/material.cpp:969   uniform sampler2D texture_albedo : source_color, %s;
 *   scene/resources/material.cpp:1066  uniform sampler2D texture_emission : source_color, hint_default_black, %s;
 *   scene/resources/material.cpp:1137  uniform sampler2D texture_detail_albedo : source_color, %s;
 *
 * Every other sampler in that file carries `hint_default_white`,
 * `hint_roughness_*` or `hint_normal` and NO `source_color`, so it is read
 * raw:
 *
 *   :1024  texture_metallic : hint_default_white
 *   :1030  texture_roughness : hint_roughness_r
 *   :1092  texture_normal : hint_roughness_normal
 *   :1128  texture_ambient_occlusion : hint_default_white
 *   :1172  texture_heightmap : hint_default_black
 *
 * `resources/processing/textureProcessing.ts` tags EVERY loaded texture
 * `SRGBColorSpace` (one shared cache entry per path), which is right for the
 * colour maps and wrong for the rest: WebGL uploads an `SRGBColorSpace`
 * texture as `SRGB8_ALPHA8`, so the hardware decodes on every sample. A
 * normal map decoded that way has its vectors bent toward the surface, and
 * roughness/metallic/AO/height all read too dark.
 *
 * The tag is asserted on the material's OWN texture object rather than on the
 * one passed in: the retag is applied to a clone, because `useResource` hands
 * the same cached texture to every consumer of a path and one of them may
 * legitimately be using it as an albedo.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { StandardMaterialSlot } from './StandardMaterialSlot';
import { parseStandardMaterial3DScalars } from './standardMaterialScalars';

/** A distinct texture per slot, so a mixed-up wiring cannot pass. */
function texture(name: string): THREE.Texture {
  const tex = new THREE.Texture();
  tex.name = name;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function materialWithEveryMap(): Promise<THREE.MeshStandardMaterial> {
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <boxGeometry />
      <StandardMaterialSlot
        scalars={parseStandardMaterial3DScalars({})}
        albedoMap={texture('albedo')}
        emissiveMap={texture('emissive')}
        normalMap={texture('normal')}
        roughnessMap={texture('roughness')}
        metalnessMap={texture('metalness')}
        aoMap={texture('ao')}
        displacementMap={texture('displacement')}
      />
    </mesh>
  );
  const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

describe('StandardMaterialSlot — texture colour spaces follow Godot’s `source_color` hints', () => {
  it('decodes the two colour maps — the slots Godot marks `source_color`', async () => {
    const material = await materialWithEveryMap();
    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.emissiveMap?.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  const RAW_SLOTS: [slot: 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap' | 'displacementMap', hint: string][] = [
    ['normalMap', 'scene/resources/material.cpp:1092 hint_roughness_normal'],
    ['roughnessMap', 'scene/resources/material.cpp:1030 hint_roughness_r'],
    ['metalnessMap', 'scene/resources/material.cpp:1024 hint_default_white'],
    ['aoMap', 'scene/resources/material.cpp:1128 hint_default_white'],
    ['displacementMap', 'scene/resources/material.cpp:1172 hint_default_black'],
  ];

  it.each(RAW_SLOTS)('samples %s raw (%s)', async (slot) => {
    const material = await materialWithEveryMap();
    const map = material[slot] as THREE.Texture | null;
    expect(map).not.toBeNull();
    expect(map!.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('retags a CLONE, leaving the shared cache entry alone for its other consumers', async () => {
    const shared = texture('shared');
    const renderer = await ReactThreeTestRenderer.create(
      <mesh>
        <boxGeometry />
        <StandardMaterialSlot scalars={parseStandardMaterial3DScalars({})} normalMap={shared} />
      </mesh>
    );
    const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;

    expect(material.normalMap).not.toBe(shared);
    expect(material.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('pins the tag, so a later write cannot put the decode back', async () => {
    const material = await materialWithEveryMap();
    const normal = material.normalMap!;
    normal.colorSpace = THREE.SRGBColorSpace;
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
  });
});
