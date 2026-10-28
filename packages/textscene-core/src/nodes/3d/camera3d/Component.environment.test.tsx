/**
 * A Camera3D's `environment` replaces its world's Environment while a viewport renders through it
 * (`renderer_scene_cull.cpp:3594-3613`).
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './index';
import '../../base/node3d/index';
import '../worldenvironment/index';
import { Camera3D } from './Component';
import { WorldEnvironment } from '../worldenvironment/Component';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { useWorldToneMap } from '../../../r3f/environment/worldToneMap';
import { ViewportActionsProvider } from '../../../r3f/contexts/ViewportActionsContext';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ToneMapper } from '../../../godot/rendering/environment/toneMapping';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { makeNode } from '../../../parser/testing/parserKit';
import { subResource } from '../../../testing/subResource';

const RESOURCES: TscnInternalResource[] = [
  subResource('Environment', 'Filmic', { tonemap_mode: '2' }),
  subResource('Environment', 'Aces', { tonemap_mode: '3' }),
];

function cameraNode(name: string, environment?: string, current = false): TscnNode {
  return makeNode(name, 'Camera3D', {
    rawProperties: {
      ...(environment ? { environment } : {}),
      ...(current ? { current: 'true' } : {}),
    },
  });
}

const WORLD_ACES = makeNode('World', 'WorldEnvironment', {
  rawProperties: { environment: 'SubResource("Aces")' },
});

function ToneMapReader() {
  return <group name="Reader" userData={{ mode: useWorldToneMap().settings?.toneMapping.mode ?? null }} />;
}

/** The tone mapper the world's viewport renders with, or null without an Environment. */
async function toneMapperOf(
  world: 'root' | 'subViewport',
  viewed: string | null,
  cameras: TscnNode[],
  worldEnvironment?: TscnNode
) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={RESOURCES}>
      <ViewportModeProvider initialShowPreviewEnvironment={false}>
        <ViewportActionsProvider initialActiveCameraPath={viewed}>
          <WorldEnvironmentScope world={world}>
            {worldEnvironment && <WorldEnvironment node={worldEnvironment} />}
            {cameras.map((node) => (
              <Camera3D key={node.name} node={node} />
            ))}
            <ToneMapReader />
          </WorldEnvironmentScope>
        </ViewportActionsProvider>
      </ViewportModeProvider>
    </SceneResourcesProvider>
  );
  return renderer.scene.find((object) => object.props.name === 'Reader').props.userData.mode;
}

describe('Camera3D environment', () => {
  it('applies while the viewer looks through the camera', async () => {
    expect(await toneMapperOf('root', 'Main', [cameraNode('Main', 'SubResource("Filmic")')])).toBe(
      ToneMapper.FILMIC
    );
  });

  it('leaves the world alone in the free view', async () => {
    expect(await toneMapperOf('root', null, [cameraNode('Main', 'SubResource("Filmic")')])).toBeNull();
  });

  it("replaces the WorldEnvironment's Environment", async () => {
    const cameras = [cameraNode('Main', 'SubResource("Filmic")')];
    expect(await toneMapperOf('root', 'Main', cameras, WORLD_ACES)).toBe(ToneMapper.FILMIC);
  });

  it("keeps the WorldEnvironment's Environment for a camera with none", async () => {
    expect(await toneMapperOf('root', 'Main', [cameraNode('Main')], WORLD_ACES)).toBe(ToneMapper.ACES);
  });

  it('applies in a sub-viewport through the camera it elects', async () => {
    const cameras = [cameraNode('A', 'SubResource("Aces")'), cameraNode('B', 'SubResource("Filmic")', true)];
    expect(await toneMapperOf('subViewport', null, cameras)).toBe(ToneMapper.FILMIC);
  });
});
