/**
 * A SubViewport renders its 3D pass at its own `texture_mipmap_bias`, which defaults to the project
 * setting (`viewport.cpp:5383`), and a render of the main view takes the root viewport's.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { SceneMipmapBias } from '../../../r3f/materials/SceneMipmapBias';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { withProject } from '../../../r3f/testing/ProjectFixture';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import { mipmapBiasUniform } from '../../../r3f/testing/mipmapBiasUniform';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

import '../../../r3f/nodes/index';

const PROJECT_BIAS = '[rendering]\n\ntextures/default_filters/texture_mipmap_bias=-0.5\n';

const scene = (viewportProps: string) => `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
own_world_3d = true
${viewportProps}

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

/**
 * A scene mounted under `project`: what bias each pass samples at, and what the main view does
 * once the project has loaded.
 */
async function sceneUnder(source: string, project: string | null) {
  const parsed = new TscnParser().parse(source);
  const ProjectFixture = withProject(project);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="3d">
      <ProjectFixture>
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <NodeDispatcher nodes={parsed.nodes} />
            <CaptureRenderer captured={captured} />
            <ViewportPassOrchestrator />
            <SceneMipmapBias />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      </ProjectFixture>
    </SceneStack>
  );
  const uniform = mipmapBiasUniform();
  const gl = captured.current!;
  return {
    /** The bias in force as the first scene of the next frame renders, which is the pass's. */
    async passBias(): Promise<number> {
      const seen: number[] = [];
      await withStubbedGl(
        gl,
        {
          onRender: (_, renderedScene, camera) => {
            fireSceneRender(renderedScene, camera);
            seen.push(uniform.value);
          },
        },
        () => renderer.advanceFrames(1, 16)
      );
      return seen[0]!;
    },
    /** The bias a render of the canvas scene samples at. */
    mainViewBias(): number {
      fireSceneRender(renderer.scene.instance as unknown as THREE.Scene, new THREE.PerspectiveCamera());
      return uniform.value;
    },
  };
}

describe('<SubViewport> texture_mipmap_bias', () => {
  it('renders its pass at the authored bias', async () => {
    const { passBias } = await sceneUnder(scene('texture_mipmap_bias = -1.5'), null);

    expect(await passBias()).toBe(-1.5);
  });

  it('renders its pass at the project bias when it authors none (viewport.cpp:5383)', async () => {
    const { passBias } = await sceneUnder(scene(''), PROJECT_BIAS);

    await waitFor(async () => expect(await passBias()).toBe(-0.5));
  });

  it('renders its pass at an authored 0 over a project bias, as 0 is a value', async () => {
    const { passBias, mainViewBias } = await sceneUnder(scene('texture_mipmap_bias = 0.0'), PROJECT_BIAS);

    await waitFor(() => expect(mainViewBias()).toBe(-0.5));
    expect(await passBias()).toBe(0);
  });

  it('passes a bias beyond the -2..2 hint through (viewport.cpp:4904-4911)', async () => {
    const { passBias } = await sceneUnder(scene('texture_mipmap_bias = -3.5'), null);

    expect(await passBias()).toBe(-3.5);
  });

  it('samples the main view at the project bias after the pass', async () => {
    const { passBias, mainViewBias } = await sceneUnder(scene('texture_mipmap_bias = 2.0'), PROJECT_BIAS);

    await waitFor(() => expect(mainViewBias()).toBe(-0.5));
    expect(await passBias()).toBe(2);
    expect(mainViewBias()).toBe(-0.5);
  });
});
