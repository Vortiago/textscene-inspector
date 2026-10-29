/**
 * The scene cull of a CPUParticles3D, which measures its multimesh's box: the mesh's box under every
 * live particle (`mesh_storage.cpp:2233-2245`). Driven by one scene render from 11 units on +Z.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { drawsColour } from '../../../../r3f/testing/threePasses';
import { manualCameraAt, renderScene } from '../../../../r3f/testing/renderScene';
import { findMesh } from '../../testing/reactThreeTestInstance';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { NO_VISIBILITY_RANGE, type VisibilityRange } from '../../../../godot/rendering/visibilityRange';
import { parseCPUParticles3D } from './parser';
import './index.r3f';

const CPUParticles3D = registeredComponent('CPUParticles3D');

const BOX: TscnInternalResource = { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(0.2, 0.2, 0.2)' } };

/** The issue's measured emitter: four particles in a row along +x, from 0 to 1.5. */
const ROW_OF_FOUR = {
  amount: '4',
  lifetime: '2.0',
  preprocess: '1.5',
  use_fixed_seed: 'true',
  seed: '7',
  direction: 'Vector3(1, 0, 0)',
  spread: '0.0',
  gravity: 'Vector3(0, 0, 0)',
  initial_velocity_min: '1.0',
  initial_velocity_max: '1.0',
  mesh: 'SubResource("Box")',
};

function emitter(range: Partial<VisibilityRange>): TscnNode {
  const properties = parseCPUParticles3D(heading('CPUParticles3D', { name: 'Row' }), ROW_OF_FOUR);
  return {
    rawProperties: {},
    name: 'Row',
    type: 'CPUParticles3D',
    children: [],
    properties: { ...properties, visibilityRange: { ...NO_VISIBILITY_RANGE, ...range } },
  } as TscnNode;
}

async function particlesDrawn(range: Partial<VisibilityRange>): Promise<boolean> {
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
      <CPUParticles3D node={emitter(range)} />
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  return drawsColour(findMesh(renderer.scene));
}

describe('<CPUParticles3D> scene cull', () => {
  it('measures an emitter with a mesh and no visibility_aabb, and draws it on the first frame', async () => {
    expect(await particlesDrawn({ begin: 5, end: 20 })).toBe(true);
  });

  it('culls it past its end', async () => {
    expect(await particlesDrawn({ end: 10 })).toBe(false);
  });

  // The box spans x -0.1 to 1.6, so its centre is 0.75 off the axis: 11.0256 from the camera.
  it("measures to the centre of the particles' box, not to the emitter's origin", async () => {
    expect(await particlesDrawn({ end: 11.02 })).toBe(false);
  });
});
