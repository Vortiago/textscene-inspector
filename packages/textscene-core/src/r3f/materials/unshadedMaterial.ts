/**
 * The material an unshaded StandardMaterial3D draws through: three's `MeshBasicMaterial`, plus the
 * displacement slot that carries its heightmap to `godotParallax.ts`, as the lit classes carry it.
 */

import * as THREE from 'three';

export interface UnshadedMaterialParameters extends THREE.MeshBasicMaterialParameters {
  displacementMap?: THREE.Texture | null;
}

export class UnshadedMaterial extends THREE.MeshBasicMaterial {
  displacementMap: THREE.Texture | null = null;

  // The slot stays out of `setValues`, which warns on a key the base class lacks.
  constructor({ displacementMap = null, ...parameters }: UnshadedMaterialParameters = {}) {
    super(parameters);
    this.displacementMap = displacementMap;
  }

  override copy(source: UnshadedMaterial): this {
    super.copy(source);
    this.displacementMap = source.displacementMap;
    return this;
  }
}
