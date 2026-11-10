/**
 * The blend of a masked owner: Godot draws it with the default clip children shader and its MIX
 * blend, whatever `CanvasItemMaterial` it carries, while the buffer fill keeps that material.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createClipMask } from './clipMask';
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

    mask.setMasking(true);
    expect(material.blending).toBe(THREE.NormalBlending);
    mask.setMasking(false);
    expect([material.blending, material.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor]);
  });

  it('keeps the own blend of an owner whose program recompiles while masking', () => {
    const { mask, material } = compiledWith();
    mask.setMasking(true);
    const shader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    };

    mask.injection.onBeforeCompile.call(material, shader);
    mask.setMasking(false);

    expect([material.blending, material.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor]);
  });
});

describe('a clip mask over a blend that changes', () => {
  it('restores the blend the owner holds after a change between masked draws', () => {
    const { mask, material } = compiledWith();
    mask.setMasking(true);
    mask.setMasking(false);

    Object.assign(material, canvasItemBlendState(CanvasItemMaterialBlendMode.MIX));
    mask.setMasking(true);
    mask.setMasking(false);

    expect(material.blending).toBe(THREE.NormalBlending);
  });
});
