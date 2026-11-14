import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { StructMember } from '../language/shaderTree.js';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import type { InterfaceBlockNode } from './templateTree.js';
import { TemplateUniforms } from './templateUniforms.js';
import { variantLines } from './variant.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

/** The uniforms of the first block of `text`, with the structs the text declares. */
function uniformsOf(text: string): TemplateUniforms {
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  const stage = parseTemplateStage('fragment', preprocess(variantLines(lines, NO_DEFINES)));
  const structs = new Map<string, readonly StructMember[]>();
  for (const declaration of stage.declarations)
    if (declaration.kind === 'struct') structs.set(declaration.name, declaration.members);
  const block = stage.declarations.find((declaration) => declaration.kind === 'interface block');
  const uniforms = new TemplateUniforms();
  uniforms.block(block as InterfaceBlockNode, (type) => {
    const members = structs.get(type);
    return members && { members };
  });
  return uniforms;
}

describe('TemplateUniforms', () => {
  it('gives each member of a struct member one uniform of its own', () => {
    const uniforms = uniformsOf(
      'struct Fog { vec3 color; float density; };\nlayout(set = 0) uniform B { Fog fog; } b;'
    );
    expect(uniforms.byName.get('b.fog.color')!.value).toEqual(new THREE.Vector3());
  });

  it('starts an integer vector at zero', () => {
    expect(uniformsOf('layout(set = 0) uniform B { ivec2 size; } b;').byName.get('b.size')!.value).toEqual(
      new THREE.Vector2()
    );
  });

  it('starts a two-column matrix at zero', () => {
    const matrix = uniformsOf('layout(set = 0) uniform B { mat2 m; } b;').byName.get('b.m')!
      .value as THREE.Matrix2;
    expect(matrix.elements).toEqual([0, 0, 0, 0]);
  });
});
