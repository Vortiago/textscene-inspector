/**
 * The scene cull of a CPUParticles3D, which measures its multimesh's box: the mesh's box under every
 * live particle (`mesh_storage.cpp:2233-2245`). Driven by one scene render from 11 units on +Z.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadParticleEmitter } from './emitterModule';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { drawsColour } from '../../../../r3f/testing/threePasses';
import { manualCameraAt, renderScene } from '../../../../r3f/testing/renderScene';
import { findMesh } from '../../testing/reactThreeTestInstance';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { BOX, emitterNode, ROW_OF_FOUR } from './cpuparticles3d.testkit';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

/** Whether the particles draw under the `visibility_range_*` keys of `range`. */
async function particlesDrawn(range: Record<string, string>): Promise<boolean> {
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      <CPUParticles3D node={emitterNode({ ...ROW_OF_FOUR, ...range })} />
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  return drawsColour(findMesh(renderer.scene));
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadParticleEmitter);

describe('<CPUParticles3D> scene cull', () => {
  it('measures an emitter with a mesh and no visibility_aabb, and draws it on the first frame', async () => {
    expect(await particlesDrawn({ visibility_range_begin: '5.0', visibility_range_end: '20.0' })).toBe(true);
  });

  it('culls it past its end', async () => {
    expect(await particlesDrawn({ visibility_range_end: '10.0' })).toBe(false);
  });

  // The box spans x -0.1 to 1.6, so its centre is 0.75 off the axis: 11.0256 from the camera.
  it("measures to the centre of the particles' box, not to the emitter's origin", async () => {
    expect(await particlesDrawn({ visibility_range_end: '11.02' })).toBe(false);
  });
});
