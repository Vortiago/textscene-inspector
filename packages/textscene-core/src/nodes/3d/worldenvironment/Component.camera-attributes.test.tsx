/** A WorldEnvironment publishes its CameraAttributes beside its Environment, each chosen apart. */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { useExposureFactor } from '../../../r3f/environment/worldExposure';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from './types';
import { subResource } from '../../../testing/subResource';

function makeNode(properties: Partial<WorldEnvironmentProperties>): TscnNode {
  const all: WorldEnvironmentProperties = { name: 'WE', environment: '', ...properties };
  return { rawProperties: {}, name: 'WE', type: 'WorldEnvironment', children: [], properties: all };
}

function ExposureReader() {
  return <group name="Reader" userData={{ factor: useExposureFactor() }} />;
}

async function exposureOf(node: TscnNode, resources: TscnInternalResource[]): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={resources}>
      <WorldEnvironmentScope world="subViewport">
        <WorldEnvironment node={node} />
        <ExposureReader />
      </WorldEnvironmentScope>
    </SceneResourcesProvider>
  );
  return renderer.scene.find((object) => object.props.name === 'Reader').props.userData.factor;
}

describe('WorldEnvironment camera_attributes', () => {
  it('scales the world by a Practical exposure_multiplier', async () => {
    const factor = await exposureOf(makeNode({ camera_attributes: 'SubResource("Cam")' }), [
      subResource('CameraAttributesPractical', 'Cam', { exposure_multiplier: '2' }),
    ]);
    expect(factor).toBe(2);
  });

  it('applies on a WorldEnvironment with no Environment', async () => {
    const factor = await exposureOf(makeNode({ environment: '', camera_attributes: 'SubResource("Cam")' }), [
      subResource('CameraAttributesPhysical', 'Cam', { exposure_multiplier: '4' }),
    ]);
    expect(factor).toBe(4);
  });

  it('applies beside an Environment that holds none of its own', async () => {
    const factor = await exposureOf(
      makeNode({ environment: 'SubResource("Env")', camera_attributes: 'SubResource("Cam")' }),
      [
        subResource('Environment', 'Env', { background_mode: '1' }),
        subResource('CameraAttributesPractical', 'Cam', { exposure_multiplier: '0.5' }),
      ]
    );
    expect(factor).toBe(0.5);
  });

  it('leaves the frame unscaled with no camera_attributes', async () => {
    expect(
      await exposureOf(makeNode({ environment: 'SubResource("Env")' }), [
        subResource('Environment', 'Env', { background_mode: '1' }),
      ])
    ).toBe(1);
  });
});
