/**
 * A Sprite2D whose `texture` is a `ViewportTexture` naming a viewport stuck
 * in an unrenderable pass cycle (`ViewportPassRegistryContext`'s cycle
 * fallback) must not sample the published-but-never-written GPU texture —
 * it must take the SAME fallback `SubViewportContainer` already takes,
 * routed through the shared choke point, `useViewportTextureSlot`
 * (`resources/textures/viewporttexture/useViewportTextureSlot.ts`).
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import * as THREE from 'three';

const warnCalls: unknown[][] = [];
vi.mock('../../../logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../logger.js')>();
  return {
    ...actual,
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
    },
  };
});

import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
} from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  useRegisterViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'ViewportSprite' } };

const VIEWPORT_TEXTURE_RESOURCE: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { id: 'ViewportTexture_1', viewport_path: 'NodePath("SubViewport")' },
};

function spriteNode(): TscnNode {
  return {
    name: 'ViewportSprite',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(heading, { texture: 'SubResource("ViewportTexture_1")' }),
  };
}

/** Publishes an entry at `path` — proving a cyclic target's stale texture is never sampled. */
function Publisher({ path, texture }: { path: string; texture: THREE.Texture }) {
  const register = useRegisterViewportTexture();
  useEffect(
    () => register(path, { texture, size: { x: 64, y: 64 } }),
    [register, path, texture]
  );
  return null;
}

/** Registers `Root/SubViewport` into a two-node cycle with `Root/Other`. */
function CyclicRegistration() {
  const register = useRegisterViewportPass();
  useEffect(() => register('Root/Other', { dependsOn: ['Root/SubViewport'], render: () => {} }), [register]);
  useEffect(
    () => register('Root/SubViewport', { dependsOn: ['Root/Other'], render: () => {} }),
    [register]
  );
  return null;
}

async function renderCyclicSprite() {
  const fake = createFakeResourceLoader();
  const publishedTexture = new THREE.Texture();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[VIEWPORT_TEXTURE_RESOURCE]} externalResources={[]}>
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CyclicRegistration />
            <Publisher path="Root/SubViewport" texture={publishedTexture} />
            <NodePathProvider path="Root/ViewportSprite">
              <Sprite2D node={spriteNode()} />
            </NodePathProvider>
          </ViewportPassProvider>
        </ViewportTextureProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return { renderer, publishedTexture };
}

describe('<Sprite2D> ViewportTexture cycle fallback', () => {
  it('never samples the cyclic target\'s published-but-unwritten texture', async () => {
    const { renderer, publishedTexture } = await renderCyclicSprite();
    const sampling = renderer.scene
      .findAll(() => true)
      .map((n) => (n.instance as THREE.Mesh).material)
      .filter((m): m is THREE.MeshBasicMaterial => !!m && !Array.isArray(m))
      .find((m) => m.map === publishedTexture);
    expect(sampling).toBeUndefined();
  });

  it('renders the missing-resource placeholder instead', async () => {
    const { renderer } = await renderCyclicSprite();
    const placeholder = renderer.scene
      .findAll(() => true)
      .map((n) => n.instance as THREE.Mesh)
      .find((m) => {
        const material = m.material as THREE.MeshBasicMaterial | undefined;
        return (
          material?.color?.getHex() === new THREE.Color('magenta').getHex() &&
          material.opacity === 0.6 &&
          (m.geometry as THREE.PlaneGeometry)?.type === 'PlaneGeometry'
        );
      });
    expect(placeholder).toBeDefined();
  });

  it('logs a warning naming the consuming Sprite2D node path', async () => {
    warnCalls.length = 0;
    await renderCyclicSprite();
    const matched = warnCalls.filter((args) => String(args[0]).includes('Root/ViewportSprite'));
    expect(matched.length).toBeGreaterThan(0);
  });
});
