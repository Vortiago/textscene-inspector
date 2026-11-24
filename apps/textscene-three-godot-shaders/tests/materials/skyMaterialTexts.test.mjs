import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skyMaterialShader } from '../../../../packages/textscene-core/src/shaders/sky/materials/skyMaterialShader.ts';
import { textToVariant } from '../../../../packages/textscene-core/src/godot/variant/reader/variantReader.ts';
import { SKY_MATERIALS_FILE } from '../../../../scripts/godot-probes/skyMaterials.mjs';

const record = JSON.parse(readFileSync(SKY_MATERIALS_FILE, 'utf8'));

/** The recorder's placeholder for a property that holds a valid texture. */
const TEXTURE = 'texture';

/** A case's properties as the generator takes them: Variants, and the names of those set to a texture. */
function generatorInput(properties) {
  const entries = Object.entries(properties);
  return {
    properties: Object.fromEntries(
      entries
        .filter(([, value]) => value !== TEXTURE && value !== null)
        .map(([name, value]) => [name, textToVariant(String(value))])
    ),
    textures: new Set(entries.filter(([, value]) => value === TEXTURE).map(([name]) => name)),
  };
}

const generated = (each) => skyMaterialShader(each.class, generatorInput(each.properties));

/** A float as the GPU reads a uniform: the nearest 32-bit float, so a 1 ulp gap of `powf` is level. */
const asUniform = (value) => (Number.isFinite(value) ? Math.fround(value).toPrecision(6) : String(value));

/** A parameter's value in the form both sides compare in: each component as a uniform reads it. */
function uniformValue(variant) {
  if (variant.type === 'COLOR') {
    const { r, g, b, a } = variant.value;
    return [r, g, b, a].map(asUniform);
  }
  if (variant.type === 'FLOAT') return [asUniform(variant.value)];
  throw new Error(`expected a FLOAT or COLOR parameter, got ${variant.type}`);
}

const uniformValues = (values) =>
  Object.fromEntries(Object.entries(values).map(([name, variant]) => [name, uniformValue(variant)]));

describe("the sky materials' shader text", () => {
  it('comes from Godot 4.6.3', () => {
    expect(record.godot).toMatch(/^4\.6\.3-stable/);
  });

  it.each(record.texts.map((each) => [each.class, JSON.stringify(each.properties), each]))(
    'equals Godot for a %s of %s',
    (_name, _properties, each) => {
      expect(generated(each).code).toBe(each.code);
    }
  );
});

describe("the sky materials' parameters", () => {
  it.each(record.parameters.map((each) => [each.class, JSON.stringify(each.properties), each]))(
    'equal the values Godot uploads for a %s of %s',
    (_name, _properties, each) => {
      const godot = Object.fromEntries(
        Object.entries(each.values).map(([name, text]) => [name, textToVariant(text)])
      );
      expect(uniformValues(generated(each).parameters)).toEqual(uniformValues(godot));
    }
  );
});
