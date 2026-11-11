import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GodotLitNodeMaterial, type LitSurfaceInputs } from './litSurfaceMaterial.js';

function emptyInputs(): LitSurfaceInputs {
  return {
    dfgTable: new THREE.DataTexture(),
    sky: { layers: new THREE.DataArrayTexture(), shown: new Float32Array(8), rotation: new Float32Array(9) },
    sunShadow: { atlas: new THREE.DepthTexture(1, 1), atlasCoord: (uv) => uv },
  };
}

describe('GodotLitNodeMaterial', () => {
  it('mounts on a mesh and draws frames under the test renderer, which has no GL context', async () => {
    const material = new GodotLitNodeMaterial(emptyInputs(), 'burley');

    const renderer = await ReactThreeTestRenderer.create(
      <mesh>
        <boxGeometry />
        <primitive object={material} attach="material" />
      </mesh>
    );
    await renderer.advanceFrames(2, 16);

    expect((renderer.scene.children[0]!.instance as THREE.Mesh).material).toBe(material);
  });
});
