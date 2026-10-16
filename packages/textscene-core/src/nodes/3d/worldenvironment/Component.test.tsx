import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from './types';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { textureTexel } from '../../../r3f/testing/backgroundTexels';

function makeNode(envRef?: string): TscnNode {
  const properties: WorldEnvironmentProperties = {
    name: 'WE',
    environment: envRef ?? '',
  };
  return {
    rawProperties: {},
    name: properties.name ?? 'WE',
    type: 'WorldEnvironment',
    children: [],
    properties,
  };
}

function environmentResource(id: string, data: Record<string, string>): TscnInternalResource {
  return { id, type: 'Environment', data };
}

async function render(node: TscnNode, resources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={resources}>
      <WorldEnvironmentScope world="root">
        <WorldEnvironment node={node} />
      </WorldEnvironmentScope>
    </SceneResourcesProvider>
  );
}

describe('<WorldEnvironment>', () => {
  it('renders a group named after the node', async () => {
    const renderer = await render(makeNode());
    expect(renderer.scene.findByProps({ name: 'WE' })).toBeDefined();
  });

  it('applies background color when background_mode=1 (BG_COLOR)', async () => {
    const node = makeNode('SubResource("Env_1")');
    const resource = environmentResource('Env_1', {
      background_mode: '1',
      background_color: 'Color(0.2, 0.4, 0.8, 1)',
    });
    const renderer = await render(node, [resource]);
    const scene = instanceAs<THREE.Scene>(renderer.scene);
    // A texture of the linear colour, so the tone curve reaches it. Compared as the sRGB hex.
    const texel = textureTexel(scene.background as THREE.DataTexture);
    expect(new THREE.Color().fromArray(texel).getHexString()).toBe('3366cc'); // (0.2,0.4,0.8) → 8-bit sRGB
  });

  it('leaves the scene without fog in a canvas with no GL context, which the fog passes need', async () => {
    const node = makeNode('SubResource("Env_2")');
    const resource = environmentResource('Env_2', {
      fog_enabled: 'true',
      fog_density: '0.1',
    });
    const renderer = await render(node, [resource]);
    expect(instanceAs<THREE.Scene>(renderer.scene).fog).toBeNull();
  });

  it('renders nothing extra when environment reference is missing', async () => {
    const node = makeNode('SubResource("Nope")');
    const renderer = await render(node, []);
    const scene = instanceAs<THREE.Scene>(renderer.scene);
    expect(scene.background).toBeNull();
    expect(scene.fog).toBeNull();
  });
});
