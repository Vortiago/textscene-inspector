/**
 * The grow line of a grown StandardMaterial3D, at the vertex stage of the derived bag:
 * `material.cpp:1458-1461` emits `VERTEX += NORMAL * grow;` when `grow_enabled`, both
 * terms model space, so the offset lands on the raw `normal` attribute before the model
 * matrix — which is why a scaled node scales it. three 0.186 declares
 * `attribute vec3 normal;` for every non-raw program (`WebGLProgram.js:626`), so the
 * basic and the physical class take the same patch.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { programShader } from '../testing/patchedFragment';
import { buildMaterial } from '../../resources/materials/standardmaterial3d/buildMaterial.testkit';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { standardMaterialBags } from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { growInjectionOf } from './godotGrow';
import { StandardMaterialSlot } from './StandardMaterialSlot';

const GROWN = { grow: 'true', grow_amount: '0.03' };

/** The vertex shader as three hands it to `onBeforeCompile`, the patch applied. */
function patchedVertex(material: THREE.Material, program: 'basic' | 'standard' | 'physical'): string {
  const shader = programShader(program);
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
    material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
  }
  return shader.vertexShader;
}

function grownLine(amount: string): string {
  return `transformed += normal * ${amount};`;
}

describe('a bag derived from grown scalars patches the program', () => {
  it('shaded class: adds the offset scaled by the normal for the authored amount', () => {
    const material = buildMaterial(parseStandardMaterial3DScalars(GROWN));
    const vertex = patchedVertex(material, 'standard');
    // Exactly where three declares `transformed`, once: three resolves the include
    // after `onBeforeCompile`, so the line lands after the declaration it becomes.
    expect(vertex.split(grownLine('0.03')).length - 1).toBe(1);
    expect(vertex.split('#include <begin_vertex>').length - 1).toBe(1);
    expect(vertex).toContain('#include <begin_vertex>\n\ttransformed += normal * 0.03;');
  });

  it('unshaded class: the basic program takes the same patch', () => {
    const material = buildMaterial(parseStandardMaterial3DScalars({ ...GROWN, shading_mode: '0' }));
    expect(patchedVertex(material, 'basic').split(grownLine('0.03')).length - 1).toBe(1);
  });

  it('physical class: the patch survives the physical upgrade', () => {
    const scalars = parseStandardMaterial3DScalars({
      ...GROWN,
      clearcoat_enabled: 'true',
      clearcoat: '0.5',
    });
    expect(scalars.grows).toBe(true);
    const material = buildMaterial(scalars);
    expect(patchedVertex(material, 'physical').split(grownLine('0.03')).length - 1).toBe(1);
  });

  it('bakes a whole-number amount with its explicit decimal, through glslFloat', () => {
    // GLSL has no int→float coercion in a constant initialiser; a whole
    // number carries one, so `1` compiles and not the bare int literal.
    const material = buildMaterial(parseStandardMaterial3DScalars({ grow: 'true', grow_amount: '1' }));
    expect(patchedVertex(material, 'standard')).toContain(grownLine('1.0'));
  });
});

describe('a bag derived without grow keeps three its own program', () => {
  it("grow off: no injection, and the vertex stage is three's own", () => {
    const material = buildMaterial(parseStandardMaterial3DScalars({}));
    expect(growInjectionOf(parseStandardMaterial3DScalars({}))).toBeUndefined();
    expect(patchedVertex(material, 'standard')).toBe(programShader('standard').vertexShader);
    expect(growInjectionOf(parseStandardMaterial3DScalars({}))).toBeUndefined();
  });

  it('the amount alone, without the flag, injects nothing (error case)', () => {
    // `material.cpp:973-974` generates the `grow` uniform only when `grow_enabled`.
    const material = buildMaterial(parseStandardMaterial3DScalars({ grow_amount: '0.03' }));
    expect(growInjectionOf(parseStandardMaterial3DScalars({ grow_amount: '0.03' }))).toBeUndefined();
    expect(patchedVertex(material, 'standard')).toBe(programShader('standard').vertexShader);
  });
});

describe('grow_amount is a program input, keyed through the injection', () => {
  const slot = (data: Record<string, string>) => (
    <mesh>
      <StandardMaterialSlot
        bags={standardMaterialBags(parseStandardMaterial3DScalars(data))}
        attach="material"
      />
    </mesh>
  );

  it('remounts the material when the amount moves', async () => {
    const renderer = await ReactThreeTestRenderer.create(slot(GROWN));
    const materialOf = () => (renderer.scene.findByType('Mesh').instance as unknown as THREE.Mesh).material;
    const first = materialOf();
    await renderer.update(slot({ grow: 'true', grow_amount: '0.02' }));
    expect(materialOf()).not.toBe(first);
  });

  it('keeps the material across a re-render of the same amount', async () => {
    const renderer = await ReactThreeTestRenderer.create(slot(GROWN));
    const materialOf = () => (renderer.scene.findByType('Mesh').instance as unknown as THREE.Mesh).material;
    const first = materialOf();
    await renderer.update(slot(GROWN));
    expect(materialOf()).toBe(first);
  });

  it('keys the two amounts apart and the same amount to one key', () => {
    // The injection's own key, which `materialProgramInputs` rides (ADR-0038).
    const scalars = (amount: number) =>
      ({ ...parseStandardMaterial3DScalars(GROWN), growAmount: amount }) as StandardMaterial3DScalars;
    const grown = growInjectionOf(scalars(0.03));
    const other = growInjectionOf(scalars(0.02));
    expect(grown?.cacheKey).not.toBe(other?.cacheKey);
    expect(grown?.cacheKey).toBe(growInjectionOf(scalars(0.03))?.cacheKey);
  });
});
