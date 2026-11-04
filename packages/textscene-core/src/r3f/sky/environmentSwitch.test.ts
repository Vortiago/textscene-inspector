import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { testRenderer } from '../../testing/recordingWebGL';
import { ENVIRONMENT_SWITCH } from './environmentSwitch';

/** The parameters three compiles a program from. `@types/three` lacks `envMapPMREM`. */
type CompiledParameters = THREE.WebGLProgramParametersWithUniforms & { envMapPMREM?: boolean };

/** The parameters three compiles a lit material's program from, under the scene's environment. */
async function compiledParameters(environment: THREE.Texture): Promise<CompiledParameters> {
  const { renderer } = await testRenderer();
  const material = new THREE.MeshStandardMaterial();
  let parameters: CompiledParameters | undefined;
  material.onBeforeCompile = (compiled) => {
    parameters = compiled;
  };
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  renderer.compile(scene, new THREE.PerspectiveCamera());
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
