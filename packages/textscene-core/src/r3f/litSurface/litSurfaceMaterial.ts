/**
 * The one reader of the lit surface's form (`litSurfaceForm.ts`): whether a surface draws through
 * the shader module's lit material, and with which program and fields. A surface the port does not
 * cover yet keeps its classic material, so both kinds draw in one frame.
 */

import * as THREE from 'three';
import { DiffuseMode } from '../../godot/rendering/materials/diffuseMode.js';
import { SpecularMode } from '../../godot/rendering/materials/specularMode.js';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag.js';
import type { GodotLitNodeMaterial, LitProgram } from '../../shaders/litNodeMaterial.js';
import { lightModesInjection, type LightModes } from '../lightModes.js';
import type { ProgramInjection } from '../materialProgramInputs.js';
import { litShading } from './litShading.js';
import { litSurfaceForm } from './litSurfaceForm.js';

/** The fields of the lit material a bag sets. */
export interface LitFields {
  color?: THREE.Color;
  roughness?: number;
  metalness?: number;
  specular: number;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  side?: THREE.Side;
  depthWrite?: boolean;
  depthTest?: boolean;
  opacity?: number;
  userData?: Record<string, unknown>;
}

/** A covered surface's lit material, before it is made. */
export interface LitSurfaceMaterial {
  program: LitProgram;
  /** One key per program, which a mount keys its material by. */
  key: string;
  fields: LitFields;
  /** A new material with the fields set. The caller owns it and disposes it. */
  create(): GodotLitNodeMaterial;
}

/** The props the lit material takes as fields, at any value. */
const FIELD_PROPS: ReadonlySet<string> = new Set([
  'color',
  'roughness',
  'metalness',
  'specularIntensity',
  'emissive',
  'emissiveIntensity',
  'clearcoat',
  'clearcoatRoughness',
  'side',
  'depthWrite',
  'depthTest',
  'opacity',
  'userData',
]);

/** Props the port does not draw yet, each with the value that draws nothing of it. */
const NEUTRAL_PROPS: Readonly<Record<string, (value: unknown) => boolean>> = {
  transparent: (value) => !value,
  vertexColors: (value) => !value,
  alphaTest: (value) => !value,
  alphaHash: (value) => !value,
  alphaToCoverage: (value) => !value,
  blending: (value) => value === undefined || value === THREE.NormalBlending,
  sheen: (value) => !value,
  anisotropy: (value) => !value,
  transmission: (value) => !value,
};

/** A texture slot, such as `map` or `normalMap`, which a covered surface leaves empty. */
const TEXTURE_PROP = /^map$|Map$/;

/** Props that draw nothing while their feature's own prop is neutral, such as a blend factor. */
const DEPENDENT_PROP = /^(normalScale|sheenColor|sheenRoughness|anisotropyRotation|thickness|blend[A-Z]\w*)$/;

/**
 * The cache key of each light-mode injection (`../lightModes.ts`), and the modes it compiles. A key
 * names one program, so a bag whose injection holds another patch finds no modes.
 */
const LIGHT_MODES_BY_KEY: ReadonlyMap<string | undefined, LightModes> = new Map(
  Object.values(DiffuseMode).flatMap((diffuseMode) =>
    Object.values(SpecularMode).map((specularMode) => {
      const modes = { diffuseMode, specularMode };
      return [cacheKeyOf(lightModesInjection(modes)), modes] as const;
    })
  )
);

function cacheKeyOf(injection: ProgramInjection | undefined): string | undefined {
  return injection?.cacheKey;
}

function isCoveredProp(key: string, value: unknown): boolean {
  if (FIELD_PROPS.has(key) || DEPENDENT_PROP.test(key)) return true;
  if (TEXTURE_PROP.test(key)) return value == null;
  return NEUTRAL_PROPS[key]?.(value) ?? value === undefined;
}

/** The light modes of a covered surface, or null for one whose program needs a patch of its own. */
function coveredModes(bag: StandardMaterialBag): LightModes | null {
  if (bag.materialClass === 'basic' || bag.heightmapTexture) return null;
  if (!Object.entries(bag.props).every(([key, value]) => isCoveredProp(key, value))) return null;
  return LIGHT_MODES_BY_KEY.get(cacheKeyOf(bag.injection)) ?? null;
}

/**
 * The bag's fields. three's `specularIntensity` is Godot's dielectric F0 of `0.16 * specular *
 * specular` over 0.04 (`materialBag.ts`), so Godot's `specular` is half its square root.
 */
function fieldsOf(props: THREE.MeshPhysicalMaterialParameters): LitFields {
  const { specularIntensity, ...fields } = props;
  const specular = specularIntensity === undefined ? 0.5 : Math.sqrt(specularIntensity) / 2;
  const picked = Object.entries(fields).filter(([key, value]) => FIELD_PROPS.has(key) && value !== undefined);
  return { ...Object.fromEntries(picked), specular };
}

/** Sets `fields` on `material`, copying each colour, as R3F's prop diff does. */
function applyFields(material: GodotLitNodeMaterial, fields: LitFields): GodotLitNodeMaterial {
  const { color, emissive, ...values } = fields;
  if (color) material.color.copy(color);
  if (emissive) material.emissive.copy(emissive);
  return Object.assign(material, values);
}

/**
 * The lit material of `bag`, or null on a page that draws the patched form, before a canvas has
 * prepared its renderer, and for a surface the port does not cover yet.
 */
export function litSurfaceMaterial(bag: StandardMaterialBag): LitSurfaceMaterial | null {
  if (litSurfaceForm() !== 'nodes') return null;
  const shading = litShading();
  const modes = shading && coveredModes(bag);
  if (!shading || !modes) return null;
  const fields = fieldsOf(bag.props as THREE.MeshPhysicalMaterialParameters);
  const program: LitProgram = { ...modes, hasClearcoat: (fields.clearcoat ?? 0) > 0 };
  return {
    program,
    key: `lit:${program.diffuseMode}:${program.specularMode}:${program.hasClearcoat}`,
    fields,
    create: () => applyFields(shading.surfaceMaterial(program), fields),
  };
}
