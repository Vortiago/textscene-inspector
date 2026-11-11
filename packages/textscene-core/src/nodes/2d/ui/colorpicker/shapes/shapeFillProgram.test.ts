import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { shapeFillInjection, type ShapeFillUniforms } from './shapeFillProgram';
import type { ShapeFragment } from './shapeFragment';

const FRAGMENT: ShapeFragment = {
  name: 'disc',
  uniforms: ['v'],
  usesOkColor: false,
  body: '\tCOLOR = vec4(vec3(v), UV.x);',
};

function uniforms(): ShapeFillUniforms {
  return {
    shape: { v: { value: 0.5 } },
    size: { value: new THREE.Vector2(256, 256) },
    canvasModulate: { value: new THREE.Color(1, 1, 1) },
  };
}

/** The basic material's program text, as three hands it to `onBeforeCompile`. */
function compiled(fragment: ShapeFragment, isLinearCanvas: boolean, own = uniforms()) {
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  shapeFillInjection(fragment, own, isLinearCanvas).onBeforeCompile.call(
    new THREE.MeshBasicMaterial(),
    shader
  );
  return shader;
}

describe('shapeFillInjection', () => {
  it("calls Godot's fragment body with UV and takes the COLOR it returns", () => {
    const { fragmentShader } = compiled(FRAGMENT, false);
    expect(fragmentShader).toContain('uniform float v;');
    expect(fragmentShader).toContain('\tCOLOR = vec4(vec3(v), UV.x);');
    expect(fragmentShader).toContain('godotShapeColor( vShapeUv )');
  });

  it('derives UV from the position, with y down', () => {
    expect(compiled(FRAGMENT, false).vertexShader).toContain(
      'vShapeUv = vec2( position.x / uShapeSize.x, -position.y / uShapeSize.y );'
    );
  });

  it('decodes the sRGB COLOR once in an sRGB canvas, and takes it as linear in a linear one', () => {
    expect(compiled(FRAGMENT, false).fragmentShader).toContain('sRGBTransferEOTF( vec4( max( shapeColor.rgb');
    expect(compiled(FRAGMENT, true).fragmentShader).not.toContain('sRGBTransferEOTF(');
  });

  it('clamps a negative COLOR at 0 before the sRGB decode, as the 8-bit target does', () => {
    expect(compiled(FRAGMENT, false).fragmentShader).toContain(
      'max( shapeColor.rgb * uShapeCanvasModulate, 0.0 )'
    );
  });

  it('binds the caller-owned uniform objects, so a new value needs no recompile', () => {
    const own = uniforms();
    const shader = compiled(FRAGMENT, false, own);
    expect(shader.uniforms.v).toBe(own.shape.v);
    expect(shader.uniforms.uShapeSize).toBe(own.size);
    expect(shader.uniforms.uShapeCanvasModulate).toBe(own.canvasModulate);
  });

  it('keys the program by fragment and canvas space', () => {
    const key = (fragment: ShapeFragment, isLinear: boolean) =>
      shapeFillInjection(fragment, uniforms(), isLinear).cacheKey;
    expect(key(FRAGMENT, false)).not.toBe(key({ ...FRAGMENT, name: 'wheel' }, false));
    expect(key(FRAGMENT, false)).not.toBe(key(FRAGMENT, true));
  });

  it('prepends the OK colour functions only to a fragment that uses them', () => {
    expect(compiled(FRAGMENT, false).fragmentShader).not.toContain('vec3 okhsl_to_srgb(vec3 hsl)');
    expect(compiled({ ...FRAGMENT, usesOkColor: true }, false).fragmentShader).toContain(
      'vec3 okhsl_to_srgb(vec3 hsl)'
    );
  });
});
