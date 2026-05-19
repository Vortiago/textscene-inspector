import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { WorldEnvironmentProperties } from '../../../nodes/3d/worldenvironment/types';

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
    // R3F `<color attach="background">` writes into scene.background.
    const scene = renderer.scene.instance;
    const bg = scene.background as { r: number; g: number; b: number } | null;
    expect(bg).not.toBeNull();
    expect(bg!.r).toBeCloseTo(0.2, 1);
    expect(bg!.g).toBeCloseTo(0.4, 1);
    expect(bg!.b).toBeCloseTo(0.8, 1);
  });

  it('attaches fog when volumetric_fog_enabled=true', async () => {
    const node = makeNode('SubResource("Env_2")');
    const resource = environmentResource('Env_2', {
      volumetric_fog_enabled: 'true',
      volumetric_fog_density: '0.1',
    });
    const renderer = await render(node, [resource]);
    expect(renderer.scene.instance.fog).not.toBeNull();
  });

  it('does NOT attach fog when volumetric_fog_enabled is false', async () => {
    const node = makeNode('SubResource("Env_3")');
    const resource = environmentResource('Env_3', {
      background_mode: '1',
      background_color: 'Color(0, 0, 0, 1)',
    });
    const renderer = await render(node, [resource]);
    expect(renderer.scene.instance.fog).toBeNull();
  });

  it('renders nothing extra when environment reference is missing', async () => {
    const node = makeNode('SubResource("Nope")');
    const renderer = await render(node, []);
    expect(renderer.scene.instance.background).toBeNull();
    expect(renderer.scene.instance.fog).toBeNull();
  });
});
