import type { ColorValue, Variant } from '../../../godot/variant/value/variant.js';
import { real, variant } from '../../../godot/variant/value/variant.js';

/** A sky material's properties as its file sets them. */
export interface SkyMaterialProperties {
  /** Each property the file sets, as a Variant. A property it leaves out keeps the constructor's value. */
  readonly properties: Readonly<Record<string, Variant>>;
  /** The texture properties that hold a valid texture, which picks the shader variant. */
  readonly textures: ReadonlySet<string>;
}

/** What a sky material hands the sky renderer: its shader, and the values its setters upload. */
export interface SkyMaterialShader {
  /** The shading language text `_update_shader` writes. */
  readonly code: string;
  /** Each uniform's value as `material_set_param` writes it, by uniform name. */
  readonly parameters: Readonly<Record<string, Variant>>;
  /** The uniform each texture property feeds, by property name. */
  readonly textureUniforms: Readonly<Record<string, string>>;
}

export type SkyMaterialGenerator = (material: SkyMaterialProperties) => SkyMaterialShader;

/** The `float` property `name`, or `fallback` for one left out or of a type a float setter refuses. */
export function floatProperty({ properties }: SkyMaterialProperties, name: string, fallback: number): number {
  const value = properties[name];
  if (value?.type === 'FLOAT') return Math.fround(value.value);
  if (value?.type === 'INT') return Math.fround(Number(value.value));
  return fallback;
}

export function colorProperty(
  { properties }: SkyMaterialProperties,
  name: string,
  fallback: ColorValue
): ColorValue {
  const value = properties[name];
  return value?.type === 'COLOR' ? value.value : fallback;
}

export function boolProperty(
  { properties }: SkyMaterialProperties,
  name: string,
  fallback: boolean
): boolean {
  const value = properties[name];
  if (value?.type === 'BOOL') return value.value;
  if (value?.type === 'INT') return value.value !== 0n;
  return fallback;
}

/** `Color * float` in Godot's 32-bit components, alpha included (`color.h:327`). */
export function scaledColor({ r, g, b, a }: ColorValue, scale: number): Variant {
  const times = (component: number) => Math.fround(component * scale);
  return variant('COLOR', { r: times(r), g: times(g), b: times(b), a: times(a) });
}

export const colorParameter = (value: ColorValue): Variant => variant('COLOR', value);

export const floatParameter = (value: number): Variant => real(value);

export const rgb = (r: number, g: number, b: number): ColorValue => ({
  r: Math.fround(r),
  g: Math.fround(g),
  b: Math.fround(b),
  a: 1,
});
