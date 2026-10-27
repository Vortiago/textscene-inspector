/**
 * A SubViewport samples the textures that only its pass draws at its own `anisotropic_filtering_level`,
 * which defaults to the project setting (`viewport.cpp:5384`), never to an outer viewport's. Content
 * that draws inline in the main view takes the project's.
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
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { withProject } from '../../../r3f/testing/ProjectFixture';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { InWorld } from '../../../r3f/testing/InWorld';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

import '../../../r3f/nodes/index';

const TEXTURE = 'res://sprite.png';
const PROJECT_LEVEL = '[rendering]\n\ntextures/default_filters/anisotropic_filtering_level=1\n';

const scene = (viewportProps: string) => `[gd_scene format=3]

[ext_resource type="Texture2D" path="${TEXTURE}" id="1"]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
${viewportProps}

[node name="Sprite" type="Sprite3D" parent="Viewport"]
texture = ExtResource("1")
texture_filter = 5

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

/** A SubViewport with its own world inside another, the sprite in the inner one. */
const nested = (outerProps: string) => `[gd_scene format=3]

[ext_resource type="Texture2D" path="${TEXTURE}" id="1"]

[node name="Root" type="Node3D"]

[node name="Outer" type="SubViewport" parent="."]
own_world_3d = true
${outerProps}

[node name="OuterCamera" type="Camera3D" parent="Outer"]

[node name="Inner" type="SubViewport" parent="Outer"]
own_world_3d = true

[node name="Sprite" type="Sprite3D" parent="Outer/Inner"]
texture = ExtResource("1")
texture_filter = 5

[node name="Camera3D" type="Camera3D" parent="Outer/Inner"]
`;

const textureOf = (root: THREE.Object3D): THREE.Texture | null => {
  let found: THREE.Texture | null = null;
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (material?.map) found = material.map;
  });
  return found;
};

/** The anisotropy the first rendered scene's sprite texture carries. */
async function spriteAnisotropy(source: string, project: string | null): Promise<number> {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 4, height: 4 };
  fake.textures.seed(TEXTURE, texture);
  const ProjectFixture = withProject(project);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <ProjectFixture>
      <SceneStack loader={fake.loader} scene={parsed} workspace="3d">
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <InWorld>
              <NodeDispatcher nodes={parsed.nodes} />
            </InWorld>
            <CaptureRenderer captured={captured} />
            <ViewportPassOrchestrator />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      </SceneStack>
    </ProjectFixture>
  );
  const seen: THREE.Texture[] = [];
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (_, renderedScene) => {
          const map = textureOf(renderedScene);
          if (map) seen.push(map);
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(seen.length).toBeGreaterThan(0);
  });
  return seen[0]!.anisotropy;
}

describe('<SubViewport> anisotropic_filtering_level', () => {
  it('samples its own world at the authored level', async () => {
    expect(await spriteAnisotropy(scene('own_world_3d = true\nanisotropic_filtering_level = 4'), null)).toBe(
      16
    );
  });

  it('samples its own world at the project level when it authors none (viewport.cpp:5384)', async () => {
    expect(await spriteAnisotropy(scene('own_world_3d = true'), PROJECT_LEVEL)).toBe(2);
  });

  it('samples its own world at an authored 0 over a project level, as 0 is a value', async () => {
    expect(
      await spriteAnisotropy(scene('own_world_3d = true\nanisotropic_filtering_level = 0'), PROJECT_LEVEL)
    ).toBe(1);
  });

  it('leaves content that draws inline in the main view at the project level', async () => {
    expect(await spriteAnisotropy(scene('anisotropic_filtering_level = 4'), PROJECT_LEVEL)).toBe(2);
  });

  it('takes the project level, not that of the outer viewport, in a viewport it nests', async () => {
    expect(await spriteAnisotropy(nested('anisotropic_filtering_level = 4'), PROJECT_LEVEL)).toBe(2);
  });
});
