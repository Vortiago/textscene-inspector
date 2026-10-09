import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { alignAlphaHash, alphaHashScaleUserData, GODOT_ALPHA_HASH } from './godotAlphaHash';
import type { ProgramShader } from '../materialProgramInputs';

/** Every three program a hashed Godot surface or its shadow compiles. */
const HASHED_PROGRAMS: Readonly<Record<string, { vertexShader: string; fragmentShader: string }>> = {
  basic: THREE.ShaderLib.basic,
  standard: THREE.ShaderLib.standard,
  physical: THREE.ShaderLib.physical,
  depth: THREE.ShaderLib.depth,
  distance: THREE.ShaderLib.distance,
};

function compiled(
  material: THREE.Material,
  program: { vertexShader: string; fragmentShader: string } = THREE.ShaderLib.basic
): ProgramShader {
  const shader: ProgramShader = { ...program, uniforms: {} };
  GODOT_ALPHA_HASH.onBeforeCompile.call(material, shader);
  return shader;
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((element, i) => expect(element).toBeCloseTo(expected.elements[i]!, 9));
}

function objectFromModel(material: THREE.Material): THREE.Matrix4 {
  return compiled(material).uniforms.godotObjectFromModel!.value as THREE.Matrix4;
}

describe.each(Object.entries(HASHED_PROGRAMS))('GODOT_ALPHA_HASH on the %s program', (_name, program) => {
  it("hashes at the material's scale and Godot's clamp", () => {
    const { fragmentShader } = compiled(new THREE.MeshBasicMaterial(), program);
    expect(fragmentShader).toContain('1.0 / ( godotAlphaHashScale * deltaMax )');
    expect(fragmentShader).toContain('clamp( threshold, 0.00001, 1.0 )');
    expect(fragmentShader).not.toContain('#include <alphahash_pars_fragment>');
  });

  it('hashes the projected vertex in the node object space', () => {
    const { vertexShader } = compiled(new THREE.MeshBasicMaterial(), program);
    expect(vertexShader.startsWith('uniform mat4 godotObjectFromModel;')).toBe(true);
    expect(vertexShader).toMatch(
      /#include <project_vertex>\s+#ifdef USE_ALPHAHASH[\s\S]*vPosition = \( godotObjectFromModel \* godotObjectPosition \)\.xyz;/
    );
  });
});

describe('GODOT_ALPHA_HASH.onBeforeCompile', () => {
  it('gives each material its own object-space uniform', () => {
    expect(objectFromModel(new THREE.MeshBasicMaterial())).not.toBe(
      objectFromModel(new THREE.MeshBasicMaterial())
    );
  });

  it('keeps one uniform for a material across recompiles (edge case)', () => {
    const material = new THREE.MeshBasicMaterial();
    expect(objectFromModel(material)).toBe(objectFromModel(material));
  });

  it('leaves a fragment shader without three’s hash as it is (error case)', () => {
    const program = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(compiled(new THREE.MeshBasicMaterial(), program).fragmentShader).toBe('void main() {}');
  });
});

describe('alphaHashScaleUserData', () => {
  it('compiles a material at the scale its userData gives', () => {
    const material = new THREE.MeshBasicMaterial({ userData: alphaHashScaleUserData(0.25) });
    expect(compiled(material).uniforms.godotAlphaHashScale!.value).toBe(0.25);
  });

  it("compiles a material with no scale at Godot's default of 1 (edge case)", () => {
    expect(compiled(new THREE.MeshBasicMaterial()).uniforms.godotAlphaHashScale!.value).toBe(1);
  });

  it('keeps a scale of 0, which Godot accepts (edge case)', () => {
    const material = new THREE.MeshBasicMaterial({ userData: alphaHashScaleUserData(0) });
    expect(compiled(material).uniforms.godotAlphaHashScale!.value).toBe(0);
  });
});

describe('alignAlphaHash', () => {
  it("takes the material's current scale for the draw", () => {
    const material = new THREE.MeshBasicMaterial();
    const { uniforms } = compiled(material);
    material.userData = alphaHashScaleUserData(1.5);

    alignAlphaHash(material, new THREE.Matrix4(), new THREE.Matrix4());

    expect(uniforms.godotAlphaHashScale!.value).toBe(1.5);
  });

  it('maps the drawn model back to the node object space', () => {
    const material = new THREE.MeshBasicMaterial();
    const uniform = objectFromModel(material);
    const node = new THREE.Matrix4().makeTranslation(1, 2, 3);
    const drawn = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(1, 2, 3);

    alignAlphaHash(material, node, drawn);

    expectSameMatrix(uniform, new THREE.Matrix4().makeRotationY(Math.PI / 2));
  });

  it('is the identity where three draws in the node pose (edge case)', () => {
    const material = new THREE.MeshBasicMaterial();
    const uniform = objectFromModel(material);
    const node = new THREE.Matrix4().makeRotationX(1).setPosition(4, 5, 6);

    alignAlphaHash(material, node, node);

    expectSameMatrix(uniform, new THREE.Matrix4());
  });

  it('leaves a material that never compiled the hash alone (error case)', () => {
    const material = new THREE.MeshBasicMaterial();
    alignAlphaHash(material, new THREE.Matrix4(), new THREE.Matrix4().makeScale(2, 2, 2));

    expect(objectFromModel(material).equals(new THREE.Matrix4())).toBe(true);
  });
});
