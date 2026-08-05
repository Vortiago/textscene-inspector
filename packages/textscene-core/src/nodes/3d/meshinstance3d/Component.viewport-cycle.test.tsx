/**
 * A MeshInstance3D whose StandardMaterial3D `albedo_texture` is a
 * `ViewportTexture` naming a viewport stuck in an unrenderable pass cycle
 * (`ViewportPassRegistryContext`'s cycle fallback) must not sample the
 * published-but-never-written GPU texture — it must take the SAME
 * magenta-placeholder fallback a missing texture takes, routed through the
 * shared choke point, `useViewportTextureSlot`
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

import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
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
import type { MeshInstance3DProperties } from './types';

function meshNode(): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'Mesh1',
    mesh: 'SubResource("box")',
    materialOverride: 'SubResource("mat")',
    surfaceMaterialOverrides: new Map(),
  };
  return { name: 'Mesh1', type: 'MeshInstance3D', children: [], properties: props };
}

const INTERNAL_RESOURCES: TscnInternalResource[] = [
  { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
  {
    id: 'mat',
    type: 'StandardMaterial3D',
    data: { id: 'mat', albedo_texture: 'SubResource("ViewportTexture_1")' } as Record<string, string>,
  },
  {
    id: 'ViewportTexture_1',
    type: 'ViewportTexture',
    data: { id: 'ViewportTexture_1', viewport_path: 'NodePath("SubViewport")' },
  },
];

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

async function renderCyclicMesh() {
  const publishedTexture = new THREE.Texture();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNAL_RESOURCES}>
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <CyclicRegistration />
          <Publisher path="Root/SubViewport" texture={publishedTexture} />
          <NodePathProvider path="Root/Mesh1">
            <MeshInstance3D node={meshNode()} />
          </NodePathProvider>
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneResourcesProvider>
  );
  return { renderer, publishedTexture };
}

describe('<MeshInstance3D> ViewportTexture albedo cycle fallback', () => {
  it('never samples the cyclic target\'s published-but-unwritten texture', async () => {
    const { renderer, publishedTexture } = await renderCyclicMesh();
    const sampling = renderer.scene
      .findAll(() => true)
      .map((n) => (n.instance as THREE.Mesh).material)
      .filter((m): m is THREE.MeshStandardMaterial => !!m && !Array.isArray(m))
      .find((m) => (m as THREE.MeshStandardMaterial).map === publishedTexture);
    expect(sampling).toBeUndefined();
  });

  it('renders the magenta missing-texture placeholder instead', async () => {
    const { renderer } = await renderCyclicMesh();
    const materials = renderer.scene.findAllByType('MeshStandardMaterial');
    const magenta = materials.find((m) => {
      const color = (m.instance as THREE.MeshStandardMaterial).color;
      return color.r > 0.9 && color.g < 0.1 && color.b > 0.9;
    });
    expect(magenta).toBeDefined();
  });

  it('logs a warning naming the consuming MeshInstance3D node path', async () => {
    warnCalls.length = 0;
    await renderCyclicMesh();
    const matched = warnCalls.filter((args) => String(args[0]).includes('Root/Mesh1'));
    expect(matched.length).toBeGreaterThan(0);
  });
});
