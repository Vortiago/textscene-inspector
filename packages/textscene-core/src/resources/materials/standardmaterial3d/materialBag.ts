/**
 * ONE StandardMaterial3D → ONE three material description: the class three needs
 * for the feature set, plus the prop bag that goes with it.
 *
 * Both adapters over the shared decode read this and nothing else — `build.ts`
 * (imperative: the class picks a constructor) and `<StandardMaterialSlot>`
 * (reactive: the class picks a JSX tag). Deriving the bag twice is what let a
 * rim highlight, a sheen roughness and a class choice mean one thing in JSX and
 * another in the loader.
 *
 * Framework-free, and textures arrive ALREADY BOUND (`textureBinding.ts`): what
 * a slot needs of the texture it samples is decided at the binding seam, which
 * each adapter crosses on its own — the loader before it calls in, the
 * per-surface component before it mounts.
 *
 * Never imported by `index.ts`: this module value-imports `three`.
 */

import * as THREE from 'three';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from '../../../r3f/materials/godotDefaultMaterial';
import { resolveEmission } from './emission';
import type {
  MaterialBlendState,
  ResolvedTextureSlots,
  StandardMaterial3DScalars,
  TextureSlot,
} from './types';

// Godot's default COLOR buffer is white (`mesh_storage.cpp:86-97`); three declares that
// default on ShaderMaterial alone, so any other class reads the WebGL generic attribute
// — (0,0,0) — and blacks out albedo. On the prototype because `copy` drops it and every
// GLB instance clones. Here because this module mints every material that can READ the
// default: the other `vertexColors` users write the attribute unconditionally, or gate
// the flag on it.
(THREE.Material.prototype as { defaultAttributeValues?: Record<string, number[]> }
).defaultAttributeValues = { color: [1, 1, 1] };

/** Which three material class a feature set needs. */
export type StandardMaterialClass = 'basic' | 'standard' | 'physical';

/**
 * The class and its props as ONE value, discriminated so an adapter cannot map
 * a class to a constructor or a tag whose parameters it did not derive.
 *
 * `attach` and the React `key` are deliberately absent: the first is the
 * reactive adapter's own mount detail, and the second is `materialProgramInputs`'
 * output, derived from the finished merged bag (ADR-0038).
 */
export type StandardMaterialBag =
  | { materialClass: 'basic'; props: THREE.MeshBasicMaterialParameters }
  | { materialClass: 'standard'; props: THREE.MeshStandardMaterialParameters }
  | { materialClass: 'physical'; props: THREE.MeshPhysicalMaterialParameters };

/**
 * Godot's default 3D material — what a surface with NO material draws. A
 * hardcoded shader rather than a default-constructed StandardMaterial3D, so it
 * has no scalars to derive from; see `godotDefaultMaterial.ts`.
 */
const NO_MATERIAL: StandardMaterialBag = {
  materialClass: 'standard',
  props: {
    color: GODOT_DEFAULT_ALBEDO,
    metalness: GODOT_DEFAULT_METALLIC,
    roughness: GODOT_DEFAULT_ROUGHNESS,
    side: THREE.FrontSide,
  },
};

/**
 * A StandardMaterial3D needs `MeshPhysicalMaterial` when any physical-only
 * feature is active: clearcoat (FEATURE_CLEARCOAT), rim → sheen (FEATURE_RIM),
 * anisotropy (FEATURE_ANISOTROPY), refraction → transmission
 * (FEATURE_REFRACTION). A three CAPABILITY mapping, not a Godot concept — the
 * engine has one spatial shader for all of them — so it lives beside the prop
 * mapping and a new physical-only feature extends exactly this set.
 */
function needsPhysicalMaterial(scalars: StandardMaterial3DScalars): boolean {
  return (
    scalars.clearcoat > 0 ||
    scalars.rim > 0 ||
    scalars.anisotropy > 0 ||
    scalars.transmission > 0
  );
}

/**
 * `rim_tint` blends the rim highlight from the light colour (0) toward the
 * albedo (1); three's closest native term is `sheenColor`.
 */
function rimSheenColor(scalars: StandardMaterial3DScalars): THREE.Color {
  const tint = scalars.rimTint;
  return new THREE.Color(
    1 + tint * (scalars.color[0] - 1),
    1 + tint * (scalars.color[1] - 1),
    1 + tint * (scalars.color[2] - 1)
  );
}

/**
 * A low `sheenRoughness` concentrates the sheen toward grazing angles, so the
 * effect reads as an edge rim rather than a broad fabric glow that would wash a
 * dark-albedo sphere out to bright grey.
 */
const RIM_SHEEN_ROUGHNESS = 0.1;

/**
 * The blending fields, with the factor fields OMITTED where the mode resolves to
 * a three preset that already carries them.
 *
 * Omitted rather than `undefined`: `Material.setValues` warns on an undefined
 * parameter, and R3F assigns whatever it is given, so an explicit `undefined`
 * would clobber three's own blending state instead of leaving it alone.
 */
function materialBlendProps(scalars: StandardMaterial3DScalars): MaterialBlendState {
  const props: MaterialBlendState = { blending: scalars.blending };
  if (scalars.blendEquation !== undefined) props.blendEquation = scalars.blendEquation;
  if (scalars.blendSrc !== undefined) props.blendSrc = scalars.blendSrc;
  if (scalars.blendDst !== undefined) props.blendDst = scalars.blendDst;
  if (scalars.blendEquationAlpha !== undefined) {
    props.blendEquationAlpha = scalars.blendEquationAlpha;
  }
  if (scalars.blendSrcAlpha !== undefined) props.blendSrcAlpha = scalars.blendSrcAlpha;
  if (scalars.blendDstAlpha !== undefined) props.blendDstAlpha = scalars.blendDstAlpha;
  return props;
}

/**
 * Derive the material this decoded StandardMaterial3D describes.
 *
 * @param scalars - the decoded material, or null for a surface with none
 * @param textures - already-bound textures by Godot slot; an absent slot lands
 *   as `null`, never `undefined`, so a late arrival cannot be mistaken for
 *   "leave whatever the material has" by either adapter
 */
export function standardMaterialBag(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): StandardMaterialBag {
  if (!scalars) return NO_MATERIAL;

  const slot = (name: TextureSlot): THREE.Texture | null => textures[name] ?? null;
  const blend = materialBlendProps(scalars);
  // `fromArray` keeps the values LINEAR. A hex would go through
  // `setHex(…, SRGBColorSpace)` and decode these already-linear channels a
  // second time, rendering everything too dark.
  const color = new THREE.Color().fromArray(scalars.color);

  // Godot SHADING_MODE_UNSHADED (0): albedo is output directly, unaffected by
  // lights. three's MeshBasicMaterial is the unlit equivalent, so no PBR slot
  // applies. Dropping EMISSION here is PARITY, not an omission: Godot's
  // unshaded branch writes `frag_color = vec4(albedo, alpha)` and never reads
  // the emission term it computed.
  if (scalars.shadingMode === 'unshaded') {
    return {
      materialClass: 'basic',
      props: {
        color,
        vertexColors: scalars.useVertexColors,
        map: slot('albedo_texture'),
        transparent: scalars.transparent,
        opacity: scalars.opacity,
        alphaTest: scalars.alphaTest,
        depthWrite: scalars.depthWrite,
        depthTest: scalars.depthTest,
        side: scalars.side,
        ...blend,
      },
    };
  }

  const emissiveMap = slot('emission_texture');
  // Godot's `emission_operator` only becomes observable once a texture is in
  // play, and whether one resolved is knowable here and not at decode time.
  const emission = resolveEmission(scalars, scalars.emissionOperator, !!emissiveMap);
  const pbr: THREE.MeshStandardMaterialParameters = {
    color,
    vertexColors: scalars.useVertexColors,
    metalness: scalars.metalness,
    roughness: scalars.roughness,
    transparent: scalars.transparent,
    opacity: scalars.opacity,
    alphaTest: scalars.alphaTest,
    depthWrite: scalars.depthWrite,
    depthTest: scalars.depthTest,
    side: scalars.side,
    map: slot('albedo_texture'),
    normalMap: slot('normal_texture'),
    normalScale: new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y),
    roughnessMap: slot('roughness_texture'),
    metalnessMap: slot('metallic_texture'),
    emissiveMap,
    aoMap: slot('ao_texture'),
    // Read field-by-field rather than spread: `scalars` is far wider than
    // `EmissionScalars`, so a pass-through inside `resolveEmission` would
    // otherwise splat every material scalar onto the material.
    emissive: new THREE.Color().fromArray(emission.emissive),
    emissiveIntensity: emission.emissiveIntensity,
    // Godot heightmap (FEATURE_HEIGHT_MAPPING) → three vertex displacement.
    // PARITY LIMITATION: Godot uses texture-space parallax; three moves real
    // vertices, so it needs a subdivided mesh and its depth is in world units.
    // Inert for a non-heightmap material (scale 0, no map).
    displacementMap: slot('heightmap_texture'),
    displacementScale: scalars.heightmapScale,
    ...blend,
  };

  if (!needsPhysicalMaterial(scalars)) return { materialClass: 'standard', props: pbr };
  return {
    materialClass: 'physical',
    props: {
      ...pbr,
      clearcoat: scalars.clearcoat,
      clearcoatRoughness: scalars.clearcoatRoughness,
      sheen: scalars.rim,
      sheenColor: rimSheenColor(scalars),
      sheenRoughness: RIM_SHEEN_ROUGHNESS,
      anisotropy: scalars.anisotropy,
      anisotropyRotation: scalars.anisotropyRotation,
      // The flowmap needs an alpha→blue repack before it means anything, so
      // only an adapter that can do one ever fills this slot.
      anisotropyMap: slot('anisotropy_flowmap'),
      transmission: scalars.transmission,
      thickness: scalars.refractionThickness,
    },
  };
}
