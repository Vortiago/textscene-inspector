/**
 * ACCEPTANCE: one material text, three arrival paths, one material state.
 *
 * A StandardMaterial3D reaches the renderer three ways, and the three used to
 * disagree:
 *
 *   inline  — a `[sub_resource]` of the SCENE, read straight off the parsed
 *             `.tscn` and rendered by `<StandardMaterialSlot>` (the reactive
 *             adapter);
 *   .tres   — a standalone material file, fetched and built by `build.ts` (the
 *             imperative adapter);
 *   sub     — a `[sub_resource]` of some other `.tres` (a mesh's per-surface
 *             material), addressed by a Sub-resource path.
 *
 * The `.tres` path decoded eighteen properties by sniffing value shapes, ignored
 * fifteen shipped features, gated a different set of flags, and forced
 * transparency from albedo alpha. Both corpus materials below rendered wrong
 * because of it. This suite is the guard: every case's property text is decoded
 * ONCE and each path must land on the same material state.
 *
 * RESIDUE this suite deliberately does not claim — each needs a file outside the
 * slice and is reported rather than hidden:
 *   - `uv1_triplanar` tiling DENSITY needs the mesh size, which only the node
 *     component has, so the `.tres` path carries the flag but nothing acts on it.
 *   - `anisotropy_flowmap` needs an alpha→blue channel repack that lives in the
 *     node layer; the `.tres` path fetches no flowmap at all.
 *   - `normal_enabled` gating over the FETCH is honoured on the `.tres` path
 *     only: the node component resolves its own texture slots and does not read
 *     the decode's slot table yet.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { applyTextureState } from '../../textures/applyTextureState';
import { resolveExtResourcePath } from '../../SubResourceResolver';
import type { TscnExternalResource } from '../../../parser/types';
import { buildStandardMaterial, materialTextureState, type ResolvedTextureSlots } from './build';
import { createMaterialFromContent } from './loadMaterial';
import { parseStandardMaterial3DScalars } from './scalars';
import { TEXTURE_SLOTS, type TextureSlot } from './types';

interface ParityCase {
  name: string;
  properties: Record<string, string>;
  /** `[ext_resource]` headers the property text references. */
  extResources?: TscnExternalResource[];
}

const ALBEDO = 'res://textures/albedo.png';
const NORMAL = 'res://textures/normal.png';
const EMISSION = 'res://textures/emission.png';

const CASES: ParityCase[] = [
  { name: 'all Godot defaults', properties: {} },
  {
    name: 'plain albedo + PBR scalars',
    properties: {
      albedo_color: 'Color(0.545098, 0.270588, 0.0745098, 1)',
      metallic: '0.7',
      roughness: '0.25',
    },
  },
  {
    name: 'albedo alpha below 1 with transparency DISABLED (must stay opaque)',
    properties: { albedo_color: 'Color(1, 1, 1, 0.4)' },
  },
  {
    name: 'ALPHA blending',
    properties: { transparency: '1', albedo_color: 'Color(0.2, 0.4, 0.8, 0.5)' },
  },
  {
    name: 'ALPHA_SCISSOR cutout with an authored threshold',
    properties: { transparency: '2', alpha_scissor_threshold: '0.35' },
  },
  {
    name: 'ALPHA_HASH',
    properties: { transparency: '3', albedo_color: 'Color(1, 1, 1, 0.5)' },
  },
  {
    name: 'additive unshaded glow (the platformer coin)',
    properties: {
      transparency: '1',
      blend_mode: '1',
      shading_mode: '0',
      albedo_color: 'Color(1, 0.858824, 0.572549, 0.25098)',
      billboard_mode: '1',
    },
  },
  { name: 'subtractive blending (CustomBlending factors)', properties: { blend_mode: '2' } },
  { name: 'multiply blending', properties: { blend_mode: '3' } },
  { name: 'premultiplied-alpha blending', properties: { blend_mode: '4' } },
  {
    // The discriminating case for `blend_mode_uses_blend_alpha`: nothing here
    // declares transparency, yet the surface belongs in the alpha pass.
    name: 'additive with transparency DISABLED (alpha pass by blend mode alone)',
    properties: { blend_mode: '1', albedo_color: 'Color(0.3, 0.6, 1, 1)' },
  },
  {
    name: 'depth_draw_mode = Always under ALPHA blending',
    properties: { transparency: '1', depth_draw_mode: '1' },
  },
  { name: 'depth_draw_mode = Never', properties: { depth_draw_mode: '2' } },
  { name: 'no_depth_test', properties: { no_depth_test: 'true' } },
  { name: 'proximity fade (alpha pass via depth_texture)', properties: { proximity_fade_enabled: 'true' } },
  {
    name: 'alpha-antialiased scissor cutout',
    properties: {
      transparency: '2',
      alpha_scissor_threshold: '0.5',
      alpha_antialiasing_mode: '1',
    },
  },
  {
    // scenes/fixtures/unit-material-refraction.tscn — refraction with NO
    // transparency mode: depth-writing, opaque, and still in the alpha pass.
    name: 'refraction with no transparency mode',
    properties: {
      albedo_color: 'Color(0.85, 0.9, 1.0, 1)',
      metallic: '0.0',
      roughness: '0.05',
      refraction_enabled: 'true',
      refraction_scale: '0.2',
    },
  },
  { name: 'front culling', properties: { cull_mode: '1' } },
  { name: 'culling disabled', properties: { cull_mode: '2' } },
  {
    name: 'vertex colours as albedo',
    properties: { vertex_color_use_as_albedo: 'true', albedo_color: 'Color(2.5, 1.5, 1, 1)' },
  },
  {
    name: 'emission colour and energy',
    properties: {
      emission_enabled: 'true',
      emission: 'Color(0, 1, 1, 1)',
      emission_energy_multiplier: '2.0',
    },
  },
  {
    name: 'emission texture over the default black colour',
    properties: {
      emission_enabled: 'true',
      emission_texture: 'ExtResource("3_em")',
      emission_energy_multiplier: '1.5',
    },
    extResources: [{ id: '3_em', path: EMISSION, type: 'Texture2D' }],
  },
  {
    name: 'emission_operator = MULTIPLY with a texture',
    properties: {
      emission_enabled: 'true',
      emission: 'Color(1, 0.5, 0, 1)',
      emission_operator: '1',
      emission_texture: 'ExtResource("3_em")',
    },
    extResources: [{ id: '3_em', path: EMISSION, type: 'Texture2D' }],
  },
  {
    name: 'albedo texture with a UV scale and offset',
    properties: {
      albedo_texture: 'ExtResource("1_tex")',
      uv1_scale: 'Vector3(3, 2, 1)',
      uv1_offset: 'Vector3(0.25, 0.125, 0)',
    },
    extResources: [{ id: '1_tex', path: ALBEDO, type: 'Texture2D' }],
  },
  {
    name: 'metallic and roughness maps (both ungated)',
    properties: {
      metallic_texture: 'ExtResource("1_tex")',
      roughness_texture: 'ExtResource("2_n")',
      metallic: '1.0',
    },
    extResources: [
      { id: '1_tex', path: ALBEDO, type: 'Texture2D' },
      { id: '2_n', path: NORMAL, type: 'Texture2D' },
    ],
  },
  {
    name: 'nearest-filter pixel art with texture_repeat off',
    properties: {
      albedo_texture: 'ExtResource("1_tex")',
      texture_filter: '0',
      texture_repeat: 'false',
    },
    extResources: [{ id: '1_tex', path: ALBEDO, type: 'Texture2D' }],
  },
  {
    name: 'normal map with normal_enabled off (the map must be dropped)',
    properties: { normal_texture: 'ExtResource("2_n")' },
    extResources: [{ id: '2_n', path: NORMAL, type: 'Texture2D' }],
  },
  {
    name: 'clearcoat + rim (physical-material upgrade)',
    properties: {
      clearcoat_enabled: 'true',
      clearcoat: '0.8',
      clearcoat_roughness: '0.2',
      rim_enabled: 'true',
      rim: '0.6',
      rim_tint: '0.75',
      albedo_color: 'Color(0.1, 0.2, 0.3, 1)',
    },
  },
  {
    name: 'height mapping',
    properties: {
      heightmap_enabled: 'true',
      heightmap_scale: '-3.5',
      heightmap_texture: 'ExtResource("1_tex")',
    },
    extResources: [{ id: '1_tex', path: ALBEDO, type: 'Texture2D' }],
  },
  {
    name: 'ambient occlusion',
    properties: { ao_enabled: 'true', ao_texture: 'ExtResource("1_tex")' },
    extResources: [{ id: '1_tex', path: ALBEDO, type: 'Texture2D' }],
  },
  {
    // scenes/demos/3d/truck_town/town/tree/Leav_material.tres — the `.tres` path
    // used to drop BOTH properties, rendering the leaves opaque and
    // single-sided.
    name: 'CORPUS truck_town tree leaves (transparency 4 + cull_mode 2)',
    properties: {
      resource_name: '"Leav_material"',
      transparency: '4',
      cull_mode: '2',
      albedo_texture: 'ExtResource("1_nh1kq")',
      roughness: '0.95770514',
      texture_filter: '5',
    },
    extResources: [
      { id: '1_nh1kq', path: 'res://town/tree/textures/Leav_material_baseColor.png', type: 'Texture2D' },
    ],
  },
  {
    // scenes/demos/3d/procedural_materials/materials/glass.tres — the `.tres`
    // path used to keep only the colour and roughness.
    name: 'CORPUS procedural_materials glass (transparency + normal_scale + refraction + triplanar)',
    properties: {
      transparency: '1',
      albedo_color: 'Color(0.423529, 0.517647, 0.623529, 0.627451)',
      roughness: '0.3',
      normal_enabled: 'true',
      normal_scale: '2.0',
      normal_texture: 'ExtResource("1_ulrqn")',
      refraction_enabled: 'true',
      refraction_texture: 'ExtResource("2_ggkhk")',
      uv1_world_triplanar: 'true',
      texture_filter: '5',
    },
    extResources: [
      { id: '1_ulrqn', path: NORMAL, type: 'Texture2D' },
      { id: '2_ggkhk', path: 'res://materials/textures/glass_refraction.tres', type: 'Texture2D' },
    ],
  },
];

/**
 * One shared texture per path, as the loader's cache hands out — so the two
 * paths' texture state is comparable, and a per-material clone is recognisable
 * as a clone rather than as a different image.
 */
const TEXTURE_BY_PATH = new Map<string, THREE.Texture>();
const SHARED_TEXTURES = new Set<THREE.Texture>();
function textureFor(path: string): THREE.Texture {
  let texture = TEXTURE_BY_PATH.get(path);
  if (!texture) {
    texture = new THREE.Texture();
    TEXTURE_BY_PATH.set(path, texture);
    SHARED_TEXTURES.add(texture);
  }
  return texture;
}
const loadTexture = async (path: string): Promise<THREE.Texture | null> => textureFor(path);

function propertyLines(properties: Record<string, string>): string[] {
  return Object.entries(properties).map(([key, value]) => `${key} = ${value}`);
}

function extResourceLines(extResources: TscnExternalResource[]): string[] {
  return extResources.map(
    (r) => `[ext_resource type="${r.type}" path="${r.path}" id="${r.id}"]`
  );
}

/** The material as its own `.tres` file. */
function standaloneTres(testCase: ParityCase): string {
  return [
    '[gd_resource type="StandardMaterial3D" format=3]',
    '',
    ...extResourceLines(testCase.extResources ?? []),
    '',
    '[resource]',
    ...propertyLines(testCase.properties),
    '',
  ].join('\n');
}

/** The same material as one surface material inside a mesh's `.tres`. */
function meshTresCarryingIt(testCase: ParityCase): string {
  return [
    '[gd_resource type="ArrayMesh" format=4]',
    '',
    ...extResourceLines(testCase.extResources ?? []),
    '',
    '[sub_resource type="StandardMaterial3D" id="Mat_surface"]',
    ...propertyLines(testCase.properties),
    '',
    '[resource]',
    '_surfaces = []',
    '',
  ].join('\n');
}

/**
 * The textures the inline (scene) path would hand the slot: resolved through the
 * scene's own `[ext_resource]` table, then carrying the material's texture state
 * — exactly what the node component does before rendering the slot.
 */
function inlineTextures(testCase: ParityCase): ResolvedTextureSlots {
  const scalars = parseStandardMaterial3DScalars(testCase.properties);
  const state = materialTextureState(scalars);
  const resolved: ResolvedTextureSlots = {};
  for (const slot of TEXTURE_SLOTS) {
    const reference = scalars.textureSlots[slot];
    if (reference === undefined) continue;
    const path = resolveExtResourcePath(reference, testCase.extResources ?? []);
    if (path === null) continue;
    resolved[slot] = applyTextureState(textureFor(path), state);
  }
  return resolved;
}

interface MaterialSnapshot {
  type: string;
  color: [number, number, number];
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  depthWrite: boolean;
  depthTest: boolean;
  side: THREE.Side;
  blending: THREE.Blending;
  blendEquation: THREE.BlendingEquation;
  blendSrc: THREE.BlendingSrcFactor;
  blendDst: THREE.BlendingDstFactor;
  blendEquationAlpha: THREE.BlendingEquation | null;
  blendSrcAlpha: THREE.BlendingSrcFactor | null;
  blendDstAlpha: THREE.BlendingDstFactor | null;
  premultipliedAlpha: boolean;
  vertexColors: boolean;
  metalness: number | null;
  roughness: number | null;
  emissive: [number, number, number] | null;
  emissiveIntensity: number | null;
  normalScale: [number, number] | null;
  displacementScale: number | null;
  clearcoat: number | null;
  clearcoatRoughness: number | null;
  sheen: number | null;
  sheenColor: [number, number, number] | null;
  sheenRoughness: number | null;
  anisotropy: number | null;
  anisotropyRotation: number | null;
  transmission: number | null;
  thickness: number | null;
  maps: Record<string, string>;
}

/** The per-slot texture, keyed so an identity mismatch names the slot. */
const SNAPSHOT_MAPS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'displacementMap',
  'anisotropyMap',
] as const;

function snapshot(material: THREE.Material): MaterialSnapshot {
  const m = material as THREE.MeshPhysicalMaterial;
  const maps: Record<string, string> = {};
  for (const key of SNAPSHOT_MAPS) {
    const texture = (m as unknown as Record<string, THREE.Texture | null>)[key];
    // Texture STATE, not identity: each path clones the shared source
    // separately when the material diverges, so two equal clones are the
    // correct answer and two different sources are not.
    maps[key] = texture
      ? [
          // `source` is shared by `Texture.clone()`, so this pins that both
          // paths landed on the same IMAGE while allowing separate clones.
          texture.source.uuid,
          SHARED_TEXTURES.has(texture) ? 'shared' : 'clone',
          texture.repeat.x,
          texture.repeat.y,
          texture.offset.x,
          texture.offset.y,
          texture.wrapS,
          texture.wrapT,
          texture.magFilter,
          texture.minFilter,
          texture.generateMipmaps,
          texture.anisotropy,
        ].join('/')
      : 'none';
  }
  return {
    type: material.type,
    color: m.color ? [m.color.r, m.color.g, m.color.b] : [0, 0, 0],
    opacity: material.opacity,
    transparent: material.transparent,
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    side: material.side,
    blending: material.blending,
    blendEquation: material.blendEquation,
    blendSrc: material.blendSrc,
    blendDst: material.blendDst,
    blendEquationAlpha: material.blendEquationAlpha ?? null,
    blendSrcAlpha: material.blendSrcAlpha ?? null,
    blendDstAlpha: material.blendDstAlpha ?? null,
    premultipliedAlpha: material.premultipliedAlpha,
    vertexColors: material.vertexColors,
    metalness: m.metalness ?? null,
    roughness: m.roughness ?? null,
    emissive: m.emissive ? [m.emissive.r, m.emissive.g, m.emissive.b] : null,
    emissiveIntensity: m.emissiveIntensity ?? null,
    normalScale: m.normalScale ? [m.normalScale.x, m.normalScale.y] : null,
    displacementScale: m.displacementScale ?? null,
    clearcoat: m.clearcoat ?? null,
    clearcoatRoughness: m.clearcoatRoughness ?? null,
    sheen: m.sheen ?? null,
    sheenColor: m.sheenColor ? [m.sheenColor.r, m.sheenColor.g, m.sheenColor.b] : null,
    sheenRoughness: m.sheenRoughness ?? null,
    anisotropy: m.anisotropy ?? null,
    anisotropyRotation: m.anisotropyRotation ?? null,
    transmission: m.transmission ?? null,
    thickness: m.thickness ?? null,
    maps,
  };
}

async function renderThroughSlot(testCase: ParityCase): Promise<THREE.Material> {
  const scalars = parseStandardMaterial3DScalars(testCase.properties);
  const textures = inlineTextures(testCase);
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <StandardMaterialSlot
        scalars={scalars}
        albedoMap={textures.albedo_texture ?? undefined}
        normalMap={textures.normal_texture ?? undefined}
        roughnessMap={textures.roughness_texture ?? undefined}
        metalnessMap={textures.metallic_texture ?? undefined}
        emissiveMap={textures.emission_texture ?? undefined}
        aoMap={textures.ao_texture ?? undefined}
        displacementMap={textures.heightmap_texture ?? undefined}
      />
    </mesh>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
}

describe('StandardMaterial3D arrival parity', () => {
  for (const testCase of CASES) {
    describe(testCase.name, () => {
      it('decodes identically from inline properties and from parsed .tres text', async () => {
        // The property text survives the round trip through the `.tres`
        // serialization, so the two paths hand the SAME bag to the same decode.
        const { parseTresFile } = await import('../../../parser/parsedResource');
        const fromFile = parseTresFile(standaloneTres(testCase));
        const inline = parseStandardMaterial3DScalars(testCase.properties);
        expect(parseStandardMaterial3DScalars(fromFile.properties)).toEqual(inline);
      });

      it('builds the same material state from a standalone .tres as from inline text', async () => {
        const inline = buildStandardMaterial(
          parseStandardMaterial3DScalars(testCase.properties),
          inlineTextures(testCase)
        );
        const fromTres = await createMaterialFromContent(standaloneTres(testCase), loadTexture);
        expect(snapshot(fromTres)).toEqual(snapshot(inline));
      });

      it('builds the same material state from a [sub_resource] of another .tres', async () => {
        const inline = buildStandardMaterial(
          parseStandardMaterial3DScalars(testCase.properties),
          inlineTextures(testCase)
        );
        const fromSub = await createMaterialFromContent(
          meshTresCarryingIt(testCase),
          loadTexture,
          'Mat_surface'
        );
        expect(snapshot(fromSub)).toEqual(snapshot(inline));
      });

      it('renders the same material state through the reactive JSX slot', async () => {
        const fromTres = await createMaterialFromContent(standaloneTres(testCase), loadTexture);
        expect(snapshot(await renderThroughSlot(testCase))).toEqual(snapshot(fromTres));
      });
    });
  }

  it('covers every texture slot the decode can enumerate', () => {
    // A slot nobody exercises is a slot that can silently diverge again.
    const exercised = new Set<TextureSlot>();
    for (const testCase of CASES) {
      for (const slot of Object.keys(
        parseStandardMaterial3DScalars(testCase.properties).textureSlots
      ) as TextureSlot[]) {
        exercised.add(slot);
      }
    }
    // `anisotropy_flowmap` is the documented exception: the `.tres` path cannot
    // repack it, so no case can claim parity for it.
    expect([...TEXTURE_SLOTS].filter((slot) => !exercised.has(slot))).toEqual([
      'anisotropy_flowmap',
    ]);
  });
});
