import type { ColorValue, Variant } from '../../../godot/variant/value/variant.js';
import { real, variant } from '../../../godot/variant/value/variant.js';
import { toFloat32 } from '../../../godot/variant/construct/variantCast.js';
import { multiplyColor } from '../../../godot/math/math.js';
import { storedColor, storedReal } from '../../../godot/math/real.js';

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

/** The `float` property `name`, or the float `fallback` for one left out or of a type a setter refuses. */
export function floatProperty({ properties }: SkyMaterialProperties, name: string, fallback: number): number {
  const value = properties[name];
  return value?.type === 'FLOAT' || value?.type === 'INT' ? toFloat32(value) : storedReal(fallback);
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
export function scaledColor(color: ColorValue, scale: number): Variant {
  return variant('COLOR', multiplyColor(color, { r: scale, g: scale, b: scale, a: scale }));
}

export const colorParameter = (value: ColorValue): Variant => variant('COLOR', value);

export const floatParameter = (value: number): Variant => real(value);

export const rgb = (r: number, g: number, b: number): ColorValue => storedColor({ r, g, b, a: 1 });

/** `build` cached by its two switches, as Godot caches one shader per variant. */
export function textPerVariant(build: (first: boolean, second: boolean) => string) {
  const texts = new Map<string, string>();
  return (first: boolean, second: boolean): string => {
    const key = `${first}${second}`;
    const text = texts.get(key) ?? build(first, second);
    texts.set(key, text);
    return text;
  };
}
