/** A Camera3D publishes the CameraAttributes it holds to its world, which renders through one camera. */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './index';
import '../../base/node3d/index';
import { Camera3D } from './Component';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { useExposureFactor } from '../../../r3f/environment/worldExposure';
import { ViewportActionsProvider } from '../../../r3f/contexts/ViewportActionsContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { makeNode } from '../../../parser/testing/parserKit';
import { subResource } from '../../../testing/subResource';

function cameraNode(name: string, attributes?: string, current = false): TscnNode {
  return makeNode(name, 'Camera3D', {
    rawProperties: {
      ...(attributes ? { attributes } : {}),
      ...(current ? { current: 'true' } : {}),
    },
  });
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
    expect(await exposureOf('root', 'Main', [cameraNode('Main', 'SubResource("Cam")')])).toBe(3);
  });

  it('leaves the frame alone in the free view', async () => {
    expect(await exposureOf('root', null, [cameraNode('Main', 'SubResource("Cam")')])).toBe(1);
  });

  it('reads a CameraAttributesPhysical as it reads a Practical', async () => {
    expect(await exposureOf('root', 'Main', [cameraNode('Main', 'SubResource("Other")')])).toBe(6);
  });

  it('scales a sub-viewport by the camera it elects', async () => {
    const nodes = [cameraNode('A', 'SubResource("Cam")'), cameraNode('B', 'SubResource("Other")', true)];
    expect(await exposureOf('subViewport', null, nodes)).toBe(6);
  });

  it('leaves the frame alone for a camera with no attributes', async () => {
    expect(await exposureOf('root', 'Main', [cameraNode('Main')])).toBe(1);
  });
});
