/**
 * An `albedo_texture` `ViewportTexture` whose viewport sits in a pass cycle
 * never samples the unwritten GPU texture. It takes the missing-texture magenta
 * placeholder through `useViewportTextureSlot`
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

import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  useRegisterViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { materialInstanceAs } from '../testing/reactThreeTestInstance';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';
import { ViewportTexturePublisher, viewportEntry } from '../../../r3f/testing/ViewportTexturePublisher';

const MeshInstance3D = registeredComponent('MeshInstance3D');

function meshNode(): TscnNode {
  const props: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'Mesh1',
    mesh: 'SubResource("box")',
    materialOverride: 'SubResource("mat")',
    surfaceMaterialOverrides: new Map(),
  };
  return { rawProperties: {}, name: 'Mesh1', type: 'MeshInstance3D', children: [], properties: props };
}

const ALBEDO_TARGET = { albedo_texture: 'SubResource("ViewportTexture_1")' };

function resources(material: Record<string, string>): TscnInternalResource[] {
  return [
    { id: 'box', type: 'BoxMesh', data: {} },
    { id: 'mat', type: 'StandardMaterial3D', data: { resource_local_to_scene: 'true', ...material } },
    VIEWPORT_TEXTURE,
  ];
}

const VIEWPORT_TEXTURE: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { viewport_path: 'NodePath("SubViewport")' },
};

/** Registers `Root/SubViewport` into a two-node cycle with `Root/Other`. */
function CyclicRegistration() {
  const register = useRegisterViewportPass();
  useEffect(() => register('Root/Other', { dependsOn: ['Root/SubViewport'], render: () => {} }), [register]);
  useEffect(() => register('Root/SubViewport', { dependsOn: ['Root/Other'], render: () => {} }), [register]);
  return null;
}

async function renderCyclicMesh(material: Record<string, string> = ALBEDO_TARGET) {
  const publishedTexture = new THREE.Texture();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={resources(material)}>
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <CyclicRegistration />
          <ViewportTexturePublisher
            path="Root/SubViewport"
            entry={viewportEntry(publishedTexture, { x: 64, y: 64 })}
          />
          <NodePathProvider path="Root/Mesh1">
            <MeshInstance3D node={meshNode()} />
          </NodePathProvider>
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneResourcesProvider>
  );
  return { renderer, publishedTexture };
}

function magentaMaterial(renderer: Awaited<ReturnType<typeof renderCyclicMesh>>['renderer']) {
  return renderer.scene.findAllByType('MeshStandardMaterial').find((m) => {
    const color = materialInstanceAs<THREE.MeshStandardMaterial>(m).color;
    return color.r > 0.9 && color.g < 0.1 && color.b > 0.9;
  });
}

describe('<MeshInstance3D> ViewportTexture albedo cycle fallback', () => {
  it("never samples the cyclic target's published-but-unwritten texture", async () => {
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
    expect(magentaMaterial(renderer)).toBeDefined();
  });

  it('renders the placeholder for a cyclic target in another slot too', async () => {
    const { renderer } = await renderCyclicMesh({
      emission_enabled: 'true',
      emission_texture: 'SubResource("ViewportTexture_1")',
    });
    expect(magentaMaterial(renderer)).toBeDefined();
  });

  it('logs a warning naming the consuming MeshInstance3D node path', async () => {
    warnCalls.length = 0;
    await renderCyclicMesh();
    const matched = warnCalls.filter((args) => String(args[0]).includes('Root/Mesh1'));
    expect(matched.length).toBeGreaterThan(0);
  });
});
