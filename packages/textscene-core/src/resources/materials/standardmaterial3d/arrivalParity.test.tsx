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
 * TWO LAYERS, because one cannot see what the other can:
 *   - a pure bag guard per case, whose comparison keys ARE the derived bag's, so
 *     every prop is covered by construction rather than by a list to maintain;
 *   - a mounted, texture-bearing snapshot per adapter, for the state that only
 *     exists AFTER the bag — what R3F's commit does to a texture, which is the
 *     axis these paths actually diverged on.
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
import type { ReactElement } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  StandardMaterialSlot,
  type StandardMaterialSlotProps,
} from '../../../r3f/materials/StandardMaterialSlot';
import { resolveExtResourcePath } from '../../SubResourceResolver';
import type { TscnExternalResource } from '../../../parser/types';
import { buildStandardMaterial } from './build';
import { standardMaterialBag, type StandardMaterialClass } from './materialBag';
import { bindSlotTexture, materialTextureState } from './textureBinding';
import { createMaterialFromContent } from './loadMaterial';
import { parseStandardMaterial3DScalars } from './scalars';
import { TEXTURE_SLOTS, type ResolvedTextureSlots, type TextureSlot } from './types';

interface ParityCase {
  name: string;
  properties: Record<string, string>;
  /** `[ext_resource]` headers the property text references. */
  extResources?: TscnExternalResource[];
}

const ALBEDO = 'res://textures/albedo.png';
const NORMAL = 'res://textures/normal.png';
const EMISSION = 'res://textures/emission.png';
const FLOWMAP = 'res://textures/flowmap.png';

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
 * Every slot bound at once, on DEFAULT sampler state — so the slots Godot binds
 * sRGB need no clone and the material is handed the loader's own cache entries.
 * That is what makes a stray retag observable; a case where every slot clones
 * cannot see one.
 */
const EVERY_SLOT: ParityCase = {
  name: 'every slot bound at once',
  properties: {
    albedo_texture: 'ExtResource("1_tex")',
    emission_enabled: 'true',
    emission_texture: 'ExtResource("3_em")',
    normal_enabled: 'true',
    normal_texture: 'ExtResource("2_n")',
    roughness_texture: 'ExtResource("2_n")',
    metallic_texture: 'ExtResource("1_tex")',
    ao_enabled: 'true',
    ao_texture: 'ExtResource("1_tex")',
    heightmap_enabled: 'true',
    heightmap_texture: 'ExtResource("1_tex")',
  },
  extResources: [
    { id: '1_tex', path: ALBEDO, type: 'Texture2D' },
    { id: '2_n', path: NORMAL, type: 'Texture2D' },
    { id: '3_em', path: EMISSION, type: 'Texture2D' },
  ],
};

/**
 * The same slots under a UV transform and an authored sampler, so every one of
 * them clones: one snapshot then covers repeat, offset, wrapping and filtering
 * as well as colour space.
 */
const EVERY_SLOT_TRANSFORMED: ParityCase = {
  name: 'every slot bound at once, transformed',
  properties: {
    ...EVERY_SLOT.properties,
    uv1_scale: 'Vector3(3, 2, 1)',
    uv1_offset: 'Vector3(0.25, 0.125, 0)',
    texture_filter: '0',
    texture_repeat: 'false',
  },
  extResources: EVERY_SLOT.extResources,
};

/**
 * Outside CASES on purpose: the `.tres` path fetches no flowmap (the alpha→blue
 * repack it needs lives in the node layer), so the two adapters cannot be
 * compared on this one — only the reactive pass-through can be.
 */
const ANISOTROPIC: ParityCase = {
  name: 'anisotropy with a flowmap',
  properties: {
    anisotropy_enabled: 'true',
    anisotropy: '0.6',
    anisotropy_flowmap: 'ExtResource("4_flow")',
  },
  extResources: [{ id: '4_flow', path: FLOWMAP, type: 'Texture2D' }],
};

/**
 * One shared texture per path, as the loader's cache hands out — so the two
 * paths' texture state is comparable and both land on the same `source`.
 *
 * Tagged `SRGBColorSpace` because that is what the loader does to every decoded
 * image before any slot is known (`resources/formats/image/textureProcessing.ts`).
 * Starting from three's own default instead would let a raw slot pass without
 * anything having to bind it.
 */
const TEXTURE_BY_PATH = new Map<string, THREE.Texture>();
function textureFor(path: string): THREE.Texture {
  let texture = TEXTURE_BY_PATH.get(path);
  if (!texture) {
    texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    TEXTURE_BY_PATH.set(path, texture);
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
 * scene's own `[ext_resource]` table, then BOUND to their slots — exactly what
 * the node component does before rendering the slot, and through the same
 * interface the imperative adapter crosses.
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
    resolved[slot] = bindSlotTexture(textureFor(path), slot, state);
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

/**
 * A bound texture's STATE, never its identity: each path clones the shared
 * source separately when the material diverges, so two equal clones are the
 * correct answer and two different sources are not.
 *
 * `source` is shared by `Texture.clone()`, so this pins that both paths landed
 * on the same IMAGE while allowing separate clones — `.source` identity is the
 * documented equality for that case (AGENTS.md).
 */
function textureFingerprint(texture: THREE.Texture): string {
  return [
    texture.source.uuid,
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
    // The state the two paths silently disagreed on for as long as each decided
    // it for itself. `''` is three's spelling of `NoColorSpace`, so it is
    // normalised to a name a failure message can be read from.
    texture.colorSpace || 'NoColorSpace',
  ].join('/');
}

function snapshot(material: THREE.Material): MaterialSnapshot {
  const m = material as THREE.MeshPhysicalMaterial;
  const maps: Record<string, string> = {};
  for (const key of SNAPSHOT_MAPS) {
    const texture = (m as unknown as Record<string, THREE.Texture | null>)[key];
    maps[key] = texture ? textureFingerprint(texture) : 'none';
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

/** The bound slots as the reactive adapter's own prop names. */
function slotProps(
  testCase: ParityCase,
  textures: ResolvedTextureSlots
): StandardMaterialSlotProps {
  return {
    scalars: parseStandardMaterial3DScalars(testCase.properties),
    albedoMap: textures.albedo_texture ?? undefined,
    normalMap: textures.normal_texture ?? undefined,
    roughnessMap: textures.roughness_texture ?? undefined,
    metalnessMap: textures.metallic_texture ?? undefined,
    emissiveMap: textures.emission_texture ?? undefined,
    aoMap: textures.ao_texture ?? undefined,
    displacementMap: textures.heightmap_texture ?? undefined,
    anisotropyMap: textures.anisotropy_flowmap ?? undefined,
  };
}

async function renderThroughSlot(testCase: ParityCase): Promise<THREE.Material> {
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <StandardMaterialSlot {...slotProps(testCase, inlineTextures(testCase))} />
    </mesh>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
}

/** The `THREE.Material` type the imperative adapter constructs per derived class. */
const TYPE_FOR: Readonly<Record<StandardMaterialClass, string>> = {
  basic: 'MeshBasicMaterial',
  standard: 'MeshStandardMaterial',
  physical: 'MeshPhysicalMaterial',
};

/**
 * A prop as the guard compares it. Textures compare by bound STATE: binding is
 * the imperative adapter's own step, and a second bind of an already-bound
 * texture is a fresh clone carrying the same state.
 */
function comparable(value: unknown): unknown {
  return value instanceof THREE.Texture ? textureFingerprint(value) : value;
}

/** The JSX tag the reactive adapter mounts for each derived class. */
const TAG_FOR: Readonly<Record<StandardMaterialClass, string>> = {
  basic: 'meshBasicMaterial',
  standard: 'meshStandardMaterial',
  physical: 'meshPhysicalMaterial',
};

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

    });
  }

  describe('one derivation, consumed verbatim by each adapter', () => {
    // The cases above are crossed with a hand-maintained key list, and both real
    // divergences hid in its blind spots. Here the comparison keys ARE the
    // derived bag's, so a prop nobody thought to list cannot go unasserted —
    // and each adapter is pinned to the SAME derivation rather than to the
    // other's output.
    for (const testCase of CASES) {
      it(`${testCase.name}: the reactive adapter mounts the derived bag`, () => {
        const textures = inlineTextures(testCase);
        const props = slotProps(testCase, textures);
        const bag = standardMaterialBag(props.scalars, textures);
        const element = StandardMaterialSlot(props) as ReactElement;
        expect(element.type).toBe(TAG_FOR[bag.materialClass]);
        // `attach` is the mount's own, and the React key is the program
        // factory's output — neither is derived, so neither is compared.
        expect(element.props).toEqual({ ...bag.props, attach: undefined });
      });

      it(`${testCase.name}: the imperative adapter constructs the derived bag`, () => {
        const textures = inlineTextures(testCase);
        const scalars = parseStandardMaterial3DScalars(testCase.properties);
        const bag = standardMaterialBag(scalars, textures);
        const material = buildStandardMaterial(scalars, textures);
        expect(material.type).toBe(TYPE_FOR[bag.materialClass]);
        const held = material as unknown as Record<string, unknown>;
        const applied: Record<string, unknown> = {};
        const derived: Record<string, unknown> = {};
        for (const [prop, value] of Object.entries(bag.props)) {
          applied[prop] = comparable(held[prop]);
          derived[prop] = comparable(value);
        }
        expect(applied).toEqual(derived);
      });
    }

    it('compares a bag with every prop on it — neither guard is vacuous', () => {
      // A derivation that silently returned `{}` would satisfy both loops above
      // for every case.
      const physical = standardMaterialBag(
        parseStandardMaterial3DScalars({ clearcoat_enabled: 'true', clearcoat: '0.5' })
      );
      expect(Object.keys(physical.props).length).toBeGreaterThan(20);
    });
  });

  describe('mounted, with every slot bound', () => {
    // What a bag guard is blind to: what R3F's own commit does to a texture
    // AFTER the bag — the sRGB it reasserts on colour-map props, and the
    // sampler state a clone carries. That is the axis these two paths actually
    // diverged on, so one mounted, texture-bearing snapshot per adapter stays.
    it('the reactive adapter lands on the state the imperative one builds', async () => {
      const fromTres = await createMaterialFromContent(
        standaloneTres(EVERY_SLOT_TRANSFORMED),
        loadTexture
      );
      expect(snapshot(await renderThroughSlot(EVERY_SLOT_TRANSFORMED))).toEqual(snapshot(fromTres));
    });

    it('passes an anisotropy flowmap through to the physical material', async () => {
      // Godot's `texture_flowmap` (`scene/resources/material.cpp:1122`) carries
      // no `source_color` hint, so it samples raw — and only
      // MeshPhysicalMaterial declares the slot at all.
      const material = await renderThroughSlot(ANISOTROPIC);
      expect(material.type).toBe('MeshPhysicalMaterial');
      const physical = material as THREE.MeshPhysicalMaterial;
      expect(physical.anisotropy).toBeCloseTo(0.6);
      expect(physical.anisotropyMap?.source).toBe(textureFor(FLOWMAP).source);
      expect(physical.anisotropyMap?.colorSpace).toBe(THREE.NoColorSpace);
    });
  });

  describe('every slot samples in the colour space Godot binds it with', () => {
    // Equality between the paths is not enough on its own: the two agreed while
    // BOTH were wrong for as long as neither asserted an absolute value. These
    // are Godot's, from the `source_color` hints on the samplers
    // `BaseMaterial3D::_update_shader` writes — `texture_albedo`
    // (`scene/resources/material.cpp:969`) and `texture_emission` (:1066) carry
    // it and are hardware-decoded; `texture_metallic` (:1024),
    // `texture_roughness` (:1030), `texture_normal` (:1092),
    // `texture_ambient_occlusion` (:1128) and `texture_heightmap` (:1172) do not
    // and read stored bytes.
    const EXPECTED: Record<string, string> = {
      map: THREE.SRGBColorSpace,
      emissiveMap: THREE.SRGBColorSpace,
      normalMap: THREE.NoColorSpace,
      roughnessMap: THREE.NoColorSpace,
      metalnessMap: THREE.NoColorSpace,
      aoMap: THREE.NoColorSpace,
      displacementMap: THREE.NoColorSpace,
    };

    function colorSpaces(material: THREE.Material): Record<string, string> {
      const m = material as unknown as Record<string, THREE.Texture | null>;
      const out: Record<string, string> = {};
      for (const key of Object.keys(EXPECTED)) {
        const texture = m[key];
        out[key] = texture ? texture.colorSpace : 'missing';
      }
      return out;
    }

    it('through the imperative adapter, from a standalone .tres', async () => {
      const material = await createMaterialFromContent(standaloneTres(EVERY_SLOT), loadTexture);
      expect(colorSpaces(material)).toEqual(EXPECTED);
    });

    it('through the imperative adapter, from a [sub_resource] of another .tres', async () => {
      const material = await createMaterialFromContent(
        meshTresCarryingIt(EVERY_SLOT),
        loadTexture,
        'Mat_surface'
      );
      expect(colorSpaces(material)).toEqual(EXPECTED);
    });

    it('through the reactive JSX slot', async () => {
      expect(colorSpaces(await renderThroughSlot(EVERY_SLOT))).toEqual(EXPECTED);
    });

    it('survives R3F reasserting sRGB on the reactive path', async () => {
      // `applyProps` force-rewrites any 8-bit RGBA texture on a colour-map prop
      // back to `SRGBColorSpace` on EVERY commit. A raw slot's tag has to be
      // proof against that, not merely correct on first render.
      const material = await renderThroughSlot(EVERY_SLOT);
      const raw = (material as THREE.MeshStandardMaterial).roughnessMap!;
      raw.colorSpace = THREE.SRGBColorSpace;
      expect(raw.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('leaves the loader’s shared cache entries on their own tag', async () => {
      // Every retag is on a clone: one path's roughness binding must not turn
      // another consumer's albedo into raw bytes.
      await createMaterialFromContent(standaloneTres(EVERY_SLOT), loadTexture);
      await renderThroughSlot(EVERY_SLOT);
      for (const path of [ALBEDO, NORMAL, EMISSION]) {
        expect(textureFor(path).colorSpace).toBe(THREE.SRGBColorSpace);
      }
    });
  });

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
    // repack it, so no case can claim ARRIVAL PARITY for it — the reactive
    // adapter's pass-through is asserted on its own instead.
    expect([...TEXTURE_SLOTS].filter((slot) => !exercised.has(slot))).toEqual([
      'anisotropy_flowmap',
    ]);
  });
});

/**
 * The fourth arrival, which is not a StandardMaterial3D at all: a material whose
 * shader we do not compile. It reaches the renderer as a `.tres` or as a
 * `[sub_resource]`, and Godot cannot tell those apart — so the surface must not
 * depend on which one it was (ADR-0041).
 */
describe('uncompiled ShaderMaterial arrival parity', () => {
  /** Godot's hardcoded default 3D shader, read off a built material. */
  function surfaceOf(material: THREE.Material) {
    const std = material as THREE.MeshStandardMaterial;
    return {
      albedoLinear: std.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace),
      roughness: std.roughness,
      metalness: std.metalness,
      transparent: std.transparent,
      opacity: std.opacity,
    };
  }

  it('the .tres arrival lands on the surface the scene arrival renders', async () => {
    const fromTres = await createMaterialFromContent(
      '[gd_resource type="ShaderMaterial" format=3]\n\n[resource]\n'
    );
    // The scene arrival: `resolveMaterialSource` declines the sub-resource, so
    // the slot mounts with no scalars — the derivation's "no material" input.
    const fromScene = buildStandardMaterial(null);
    expect(surfaceOf(fromTres)).toEqual(surfaceOf(fromScene));
  });

  it('that surface is Godot’s default 3D shader, not a default StandardMaterial3D', async () => {
    // The distinction the whole decision turns on: a default-CONSTRUCTED
    // StandardMaterial3D is white and fully rough, which is a different surface
    // and would look like a material that rendered.
    const shader = surfaceOf(await createMaterialFromContent(
      '[gd_resource type="ShaderMaterial" format=3]\n\n[resource]\n'
    ));
    expect(shader.albedoLinear.r).toBeCloseTo(0.6, 5);
    expect(shader.roughness).toBeCloseTo(0.8, 5);
    expect(shader.metalness).toBeCloseTo(0.2, 5);

    const defaultConstructed = surfaceOf(
      buildStandardMaterial(parseStandardMaterial3DScalars({}))
    );
    expect(defaultConstructed.albedoLinear.r).not.toBeCloseTo(0.6, 2);
  });

  it('the reactive adapter mounts that same surface for a null material', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StandardMaterialSlot scalars={null} />
    );
    const mounted = renderer.scene.findAllByType('MeshStandardMaterial')[0];
    expect(mounted).toBeDefined();
    const built = surfaceOf(buildStandardMaterial(null));
    expect((mounted!.props as { roughness: number }).roughness).toBeCloseTo(built.roughness, 5);
    expect((mounted!.props as { metalness: number }).metalness).toBeCloseTo(built.metalness, 5);
  });
});
