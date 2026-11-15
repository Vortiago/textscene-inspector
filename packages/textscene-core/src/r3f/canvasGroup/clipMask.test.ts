/**
 * The blend of a masked owner: Godot draws it with the default clip children shader and its MIX
 * blend, whatever `CanvasItemMaterial` it carries, while the buffer fill keeps that material.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createClipMask, maskedInjection } from './clipMask';
import { canvasItemLightingProps } from '../lighting2d/canvasItemLighting';
import { lightUniforms } from '../lighting2d/testing/lightUniforms';
import { canvasItemBlendState } from '../../resources/materials/canvasitemmaterial/build';
import { CanvasItemMaterialBlendMode } from '../../godot/scene/canvasItemMaterial';

function compiledWith(mask = createClipMask()) {
  const material = new THREE.MeshBasicMaterial(canvasItemBlendState(CanvasItemMaterialBlendMode.ADD));
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {},
  };
  mask.injection.onBeforeCompile.call(material, shader);
  return { mask, material };
}

describe('a clip mask', () => {
  it('draws the owner with MIX blending while masking, and with its own blend otherwise', () => {
    const { mask, material } = compiledWith();

    mask.startMasking();
    expect(material.blending).toBe(THREE.NormalBlending);
    mask.stopMasking();
    expect([material.blending, material.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor]);
  });

  it('keeps the own blend of an owner whose program recompiles while masking', () => {
    const { mask, material } = compiledWith();
    mask.startMasking();
    const shader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    };

    mask.injection.onBeforeCompile.call(material, shader);
    mask.stopMasking();

    expect([material.blending, material.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor]);
  });
});

describe('a clip mask over a blend that changes', () => {
  it('restores the blend the owner holds after a change between masked draws', () => {
    const { mask, material } = compiledWith();
    mask.startMasking();
    mask.stopMasking();

    Object.assign(material, canvasItemBlendState(CanvasItemMaterialBlendMode.MIX));
    mask.startMasking();
    mask.stopMasking();

    expect(material.blending).toBe(THREE.NormalBlending);
  });
});

describe('a clip mask over a lit owner', () => {
  it('replaces the lit colour, as Godot draws the owner with its unshaded clip shader', () => {
    const lit = canvasItemLightingProps(lightUniforms(), false).injection;
    const shader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    };

    maskedInjection(lit, createClipMask()).onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);

    const lightWrite = shader.fragmentShader.indexOf('gl_FragColor.rgb = canvasShaded(');
    const maskWrite = shader.fragmentShader.indexOf('gl_FragColor.rgb = texelFetch(uClipBuffer');
    expect(lightWrite).toBeGreaterThan(-1);
    expect(maskWrite).toBeGreaterThan(lightWrite);
  });
});
