import { describe, expect, it } from 'vitest';
import { MaterialFeature, MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import { wrapInt32 } from '../../godot/variant/cInteger.js';
import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import { componentsOf, type StructVariant } from '../../godot/variant/value/mathLayout.js';
import type { Variant } from '../../godot/variant/value/variant.js';
import type { MaterialKey } from './materialKey.js';
import { materialParameters } from './materialParameters.js';
import { materialStateOf, type MaterialState } from './materialProperties.js';
import { materialSettingsOf } from './materialSettings.js';
import SETTERS from './materialSetters.generated.json';

describe('materialSettingsOf', () => {
  it('reads a bool, an int, a float, a colour and a vector from their text, in float32 lanes', () => {
    const settings = materialSettingsOf({
      clearcoat_enabled: 'true',
      diffuse_mode: '3',
      roughness: '0.25',
      albedo_color: 'Color(0.2, 0.4, 0.6, 0.8)',
      uv1_scale: 'Vector3(2, 3, 4)',
    });

    expect(settings).toEqual({
      clearcoat_enabled: true,
      diffuse_mode: 3,
      roughness: 0.25,
      albedo_color: [0.2, 0.4, 0.6, 0.8].map(Math.fround),
      uv1_scale: [2, 3, 4],
    });
  });

  it('keeps the order the file writes the properties in, which is the order Godot sets them', () => {
    const settings = materialSettingsOf({ stencil_flags: '2', stencil_mode: '1' });

    expect(Object.keys(settings)).toEqual(['stencil_flags', 'stencil_mode']);
  });

  it('leaves out a resource and a value no setter of the material takes', () => {
    const settings = materialSettingsOf({
      albedo_texture: 'ExtResource("1_tex")',
      resource_name: '"Rock"',
      roughness: '0.5',
    });

    expect(settings).toEqual({ roughness: 0.5 });
  });
});

/** What a setter's property holds once the port's setters ran, as a plain value to compare. */
type Reader = (state: MaterialState, parameters: Record<string, Variant>) => Plain;
type Plain = boolean | number | readonly number[] | null;

const plainOf = (value: Variant): Plain => {
  if (value.type === 'NIL') return null;
  if (value.type === 'BOOL') return value.value;
  if (value.type === 'INT') return Number(value.value);
  if (value.type === 'FLOAT') return value.value;
  return componentsOf(value as StructVariant);
};

const keyOf =
  (member: keyof MaterialKey): Reader =>
  ({ key }) =>
    key[member] as Plain;
const parameterOf =
  (name: string): Reader =>
  (_, parameters) =>
    plainOf(parameters[name]!);
/** A channel's parameter is the mask of the channel the setter kept. */
const maskOf =
  (name: string): Reader =>
  (_, parameters) =>
    plainOf(parameters[name]!);

const READERS: Readonly<Record<string, Reader>> = {
  grow: keyOf('grow'),
  heightmap_deep_parallax: keyOf('deepParallax'),
  particles_anim_loop: parameterOf('particles_anim_loop'),
  rim_enabled: ({ key }) => key.features.has(MaterialFeature.RIM),
  uv1_triplanar: ({ key }) => key.flags.has(MaterialFlag.UV1_USE_TRIPLANAR),
  heightmap_min_layers: parameterOf('heightmap_min_layers'),
  particles_anim_h_frames: parameterOf('particles_anim_h_frames'),
  stencil_reference: keyOf('stencilReference'),
  stencil_flags: keyOf('stencilFlags'),
  blend_mode: keyOf('blendMode'),
  transparency: keyOf('transparency'),
  cull_mode: keyOf('cullMode'),
  stencil_mode: keyOf('stencilMode'),
  roughness: parameterOf('roughness'),
  metallic: parameterOf('metallic'),
  uv1_triplanar_sharpness: parameterOf('uv1_blend_sharpness'),
  proximity_fade_distance: parameterOf('proximity_fade_distance'),
  uv1_scale: parameterOf('uv1_scale'),
  albedo_color: parameterOf('albedo'),
  emission: parameterOf('emission'),
  metallic_texture_channel: maskOf('metallic_texture_channel'),
  ao_texture_channel: maskOf('ao_texture_channel'),
  roughness_texture_channel: keyOf('roughnessTextureChannel'),
  albedo_texture: () => null,
};

/** Godot's answer in the form the reader gives: an enum as its int32 bits, a channel as its mask. */
function expectedOf({ kind, property, godot }: SetterRow): Plain {
  const value = plainOf(textToVariant(godot));
  if (kind === 'enum' || property === 'roughness_texture_channel') return wrapInt32(Number(value));
  if (kind === 'textureChannel') return plainOf(parametersOf({ [property]: String(value) })[property]!);
  if (typeof value === 'number' && kind !== 'int' && kind !== 'flags') return Math.fround(value);
  return value;
}

const parametersOf = (properties: Record<string, string>) =>
  materialParameters(materialStateOf('StandardMaterial3D', materialSettingsOf(properties)));

interface SetterRow {
  readonly kind: string;
  readonly property: string;
  readonly input: string;
  readonly godot: string;
}

// Each row is Godot 4.6.3's answer, measured by `pnpm godot:material-setters`.
describe('what each BaseMaterial3D setter keeps of a value a file writes, against Godot', () => {
  it.each(
    (SETTERS.rows as readonly SetterRow[]).map((row) => ({ ...row, at: `${row.property} = ${row.input}` }))
  )('$at', (row) => {
    const state = materialStateOf('StandardMaterial3D', materialSettingsOf({ [row.property]: row.input }));
    const found = READERS[row.property]!(state, materialParameters(state));

    expect(typeof found === 'number' && row.kind === 'enum' ? wrapInt32(found) : found).toEqual(
      expectedOf(row)
    );
  });
});
