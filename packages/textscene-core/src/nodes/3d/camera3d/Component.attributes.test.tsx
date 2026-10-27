/** A Camera3D publishes the CameraAttributes it holds to its world, which renders through one camera. */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3D } from './Component';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { useExposureFactor } from '../../../r3f/environment/worldExposure';
import { ViewportActionsProvider } from '../../../r3f/contexts/ViewportActionsContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { Camera3DProperties } from './types';
import { parseCamera3D } from './parser';
import { subResource } from '../../../testing/subResource';

function makeNode(name: string, attributes?: string, current = false): TscnNode {
  const properties = parseCamera3D(
    { type: 'Camera3D', attributes: { name } },
    {
      ...(attributes ? { attributes } : {}),
      ...(current ? { current: 'true' } : {}),
    }
  ) as Camera3DProperties;
  return { rawProperties: {}, name, type: 'Camera3D', children: [], properties };
}

function ExposureReader() {
  return <group name="Reader" userData={{ factor: useExposureFactor() }} />;
}

const RESOURCES: TscnInternalResource[] = [
  subResource('CameraAttributesPractical', 'Cam', { exposure_multiplier: '3' }),
  subResource('CameraAttributesPhysical', 'Other', { exposure_multiplier: '6' }),
];

async function exposureOf(world: 'root' | 'subViewport', viewed: string | null, nodes: TscnNode[]) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={RESOURCES}>
      <ViewportActionsProvider initialActiveCameraPath={viewed}>
        <WorldEnvironmentScope world={world}>
          {nodes.map((node) => (
            <Camera3D key={node.name} node={node} />
          ))}
          <ExposureReader />
        </WorldEnvironmentScope>
      </ViewportActionsProvider>
    </SceneResourcesProvider>
  );
  return renderer.scene.find((object) => object.props.name === 'Reader').props.userData.factor;
}

describe('Camera3D attributes', () => {
  it('scales the frame while the viewer looks through the camera', async () => {
    expect(await exposureOf('root', 'Main', [makeNode('Main', 'SubResource("Cam")')])).toBe(3);
  });

  it('leaves the frame alone in the free view', async () => {
    expect(await exposureOf('root', null, [makeNode('Main', 'SubResource("Cam")')])).toBe(1);
  });

  it('reads a CameraAttributesPhysical as it reads a Practical', async () => {
    expect(await exposureOf('root', 'Main', [makeNode('Main', 'SubResource("Other")')])).toBe(6);
  });

  it('scales a sub-viewport by the camera it elects', async () => {
    const nodes = [makeNode('A', 'SubResource("Cam")'), makeNode('B', 'SubResource("Other")', true)];
    expect(await exposureOf('subViewport', null, nodes)).toBe(6);
  });

  it('renders alone, outside any world', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={RESOURCES}>
        <Camera3D node={makeNode('Main', 'SubResource("Cam")')} />
      </SceneResourcesProvider>
    );
    expect(renderer.scene.findAllByType('PerspectiveCamera')).toHaveLength(1);
  });

  it('leaves the frame alone for a camera with no attributes', async () => {
    expect(await exposureOf('root', 'Main', [makeNode('Main')])).toBe(1);
  });
});
