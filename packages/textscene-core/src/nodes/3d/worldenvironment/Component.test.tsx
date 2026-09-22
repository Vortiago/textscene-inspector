import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from './types';
import { instanceAs } from '../testing/reactThreeTestInstance';

function makeNode(envRef?: string): TscnNode {
  const properties: WorldEnvironmentProperties = {
    name: 'WE',
    environment: envRef ?? '',
  };
  return { name: properties.name ?? 'WE', type: 'WorldEnvironment', children: [], properties };
}

function environmentResource(id: string, data: Record<string, string>): TscnInternalResource {
  return { id, type: 'Environment', data };
}

async function render(node: TscnNode, resources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={resources}>
      <WorldEnvironment node={node} />
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
    const bg = scene.background as { getHexString(): string } | null;
    expect(bg).not.toBeNull();
    // Godot Color is sRGB; three.js stores linear, so compare via the sRGB hex.
    expect(bg!.getHexString()).toBe('3366cc'); // (0.2,0.4,0.8) → 8-bit sRGB
  });

  it('attaches fog when fog_enabled=true (screen-space fog)', async () => {
    const node = makeNode('SubResource("Env_2")');
    const resource = environmentResource('Env_2', {
      fog_enabled: 'true',
      fog_density: '0.1',
    });
    const renderer = await render(node, [resource]);
    expect(instanceAs<THREE.Scene>(renderer.scene).fog).not.toBeNull();
  });

  it('does NOT attach fog when volumetric_fog_enabled is false', async () => {
    const node = makeNode('SubResource("Env_3")');
    const resource = environmentResource('Env_3', {
      background_mode: '1',
      background_color: 'Color(0, 0, 0, 1)',
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
