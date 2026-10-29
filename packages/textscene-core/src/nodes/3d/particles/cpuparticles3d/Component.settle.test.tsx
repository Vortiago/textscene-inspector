/**
 * When <CPUParticles3D> runs its settle, and from which transform: once on mount, from Godot's float
 * global transform.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadSimulate } from './simulateModule';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { BOX, emitterNode, ROW_OF_FOUR } from './cpuparticles3d.testkit';
import { storedTransform3D } from '../../../../godot/math/transform3d';
import { settleParticles } from './simulate';
import './index.r3f';

vi.mock('./simulate', async (importOriginal) => {
  const simulate = await importOriginal<typeof import('./simulate')>();
  return { ...simulate, settleParticles: vi.fn(simulate.settleParticles) };
});

const CPUParticles3D = registeredComponent('CPUParticles3D');

// The node's own transform makes its sampled global transform differ from the identity.
const MOVED = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)';

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadSimulate);

describe('<CPUParticles3D> settle', () => {
  it.each(['true', 'false'])('settles once on mount, local_coords = %s', async (localCoords) => {
    vi.mocked(settleParticles).mockClear();
    await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
        <CPUParticles3D node={emitterNode({ ...ROW_OF_FOUR, local_coords: localCoords, transform: MOVED })} />
      </SceneResourcesProvider>
    );
    expect(settleParticles).toHaveBeenCalledTimes(1);
  });

  // `node_3d.cpp:655-660` composes in float, so the transform holds float components, not three's doubles.
  it('settles from the float global transform', async () => {
    vi.mocked(settleParticles).mockClear();
    const turned = 'Transform3D(0.3, 0.7, 0.1, -0.2, 0.4, 1.1, 0.5, -0.9, 0.3, 0.1, 0.2, 0.3)';
    await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[BOX]} externalResources={[]}>
        <CPUParticles3D node={emitterNode({ ...ROW_OF_FOUR, local_coords: 'false', transform: turned })} />
      </SceneResourcesProvider>
    );
    const { emissionTransform } = vi.mocked(settleParticles).mock.lastCall![0];
    expect(emissionTransform).toEqual(storedTransform3D(emissionTransform));
  });
});
