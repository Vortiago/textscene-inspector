import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { ENVIRONMENT_SWITCH } from './environmentSwitch';

/** The environment terms three compiles a lit material's program from. `@types/three` lacks `envMapPMREM`. */
interface EnvironmentParameters {
  envMap?: unknown;
  envMapPMREM?: unknown;
}

/** The parameters three compiles a lit material's program from, under the scene's environment. */
async function compiledParameters(environment: THREE.Texture): Promise<EnvironmentParameters> {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  await ReactThreeTestRenderer.create(<CaptureRenderer captured={captured} />);
  const material = new THREE.MeshStandardMaterial();
  let parameters: EnvironmentParameters | undefined;
  material.onBeforeCompile = (compiled) => {
    parameters = compiled;
  };
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  captured.current!.compile(scene, new THREE.PerspectiveCamera());
  if (!parameters) throw new Error('expected three to compile the material, got no program');
  return parameters;
}

describe('ENVIRONMENT_SWITCH', () => {
  it("turns on three's prefiltered environment lighting, which the sky lighting patch replaces", async () => {
    const parameters = await compiledParameters(ENVIRONMENT_SWITCH);
    expect(parameters.envMap).toBe(true);
    expect(parameters.envMapPMREM).toBe(true);
  });
});
