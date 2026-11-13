import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lightSizeDeclaration, lightSpecularDeclaration } from './lightDeclarations.js';

describe('lightSpecularDeclaration', () => {
  it('reads the amount a light declares', () => {
    const light = new THREE.DirectionalLight();
    light.userData = lightSpecularDeclaration.userData({ amount: 0.25 });

    expect(lightSpecularDeclaration.read(light)).toEqual({ amount: 0.25 });
  });

  it('reads nothing from a malformed declaration', () => {
    const light = new THREE.DirectionalLight();
    light.userData = { godotLightSpecular: { amount: 'full' } };

    expect(lightSpecularDeclaration.read(light)).toBeNull();
  });
});

describe('lightSizeDeclaration', () => {
  it('reads the size a light declares', () => {
    const light = new THREE.DirectionalLight();
    light.userData = lightSizeDeclaration.userData({ size: 0.01 });

    expect(lightSizeDeclaration.read(light)).toEqual({ size: 0.01 });
  });

  it('reads nothing from a light that declares none', () => {
    expect(lightSizeDeclaration.read(new THREE.DirectionalLight())).toBeNull();
  });
});
