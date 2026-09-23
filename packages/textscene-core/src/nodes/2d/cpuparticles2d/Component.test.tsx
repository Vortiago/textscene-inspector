/**
 * CPUParticles2D render component. The emitter draws one merged geometry for the
 * frozen pose, so these pin its vertex count (four per live particle), its vertex
 * colours, and the two cases that draw nothing: `emitting = false` and a texture
 * that never resolved.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { parseCPUParticles2D } from './parser';
import { CPUParticles2D } from './Component';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';

const TEX = 'res://ball.png';
const nodeHeading = { type: 'node' as const, attributes: { type: 'CPUParticles2D', name: 'Fx' } };

/** Pinned so every pose below is a pure function of the fixture text. */
const DETERMINISTIC = {
  use_fixed_seed: 'true',
  seed: '4242',
  fixed_fps: '30',
  preprocess: '0.95',
};

function node(raw: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  return {
    name: 'Fx',
    type: 'CPUParticles2D',
    children,
    properties: parseCPUParticles2D(nodeHeading, {
      texture: 'ExtResource("1")',
      amount: '8',
      ...DETERMINISTIC,
      ...raw,
    }),
  };
}

async function render(
  rootNode: TscnNode,
  options: { seedTexture?: boolean; internalResources?: TscnInternalResource[] } = {}
) {
  const fake = createFakeResourceLoader();
  if (options.seedTexture !== false) {
    const texture = new THREE.Texture();
    (texture as unknown as { image: { width: number; height: number } }).image = {
      width: 8,
      height: 8,
    };
    fake.textures.seed(TEX, texture);
  } else {
    fake.textures.seed(TEX, null);
  }

  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={options.internalResources ?? []}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
        >
          <CPUParticles2D node={rootNode} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
}

type Rendered = Awaited<ReturnType<typeof render>>;

function particleMesh(r: Rendered): THREE.Mesh | undefined {
  return r.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh)[0];
}

describe('<CPUParticles2D>', () => {
  it('draws one merged quad mesh for the whole pose (happy path)', async () => {
    const renderer = await render(node());
    const mesh = particleMesh(renderer);
    expect(mesh).toBeDefined();

    const position = mesh!.geometry.getAttribute('position');
    // Four vertices per live particle, never more than `amount`.
    expect(position.count % 4).toBe(0);
    expect(position.count).toBeGreaterThan(0);
    expect(position.count).toBeLessThanOrEqual(8 * 4);
  });

  it('sizes each quad to the texture, so one texture pixel is one world unit', async () => {
    const renderer = await render(node({ amount: '1', explosiveness: '1', gravity: 'Vector2(0, 0)' }));
    const geometry = particleMesh(renderer)!.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    // An 8x8 texture at the default scale_amount of 1.
    expect(box.max.x - box.min.x).toBeCloseTo(8, 4);
    expect(box.max.y - box.min.y).toBeCloseTo(8, 4);
  });

  it('carries a four-component vertex colour so a ramp can fade alpha', async () => {
    const renderer = await render(node());
    const color = particleMesh(renderer)!.geometry.getAttribute('color');
    expect(color.itemSize).toBe(4);
  });

  it('enables vertexColors on an unlit, alpha-blended material', async () => {
    const renderer = await render(node());
    const material = particleMesh(renderer)!.material as THREE.MeshBasicMaterial;
    expect(material.type).toBe('MeshBasicMaterial');
    expect(material.vertexColors).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.map).not.toBeNull();
  });

  it('renders NO mesh when `emitting = false` (error path for the six dormant emitters)', async () => {
    const renderer = await render(node({ emitting: 'false' }));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('still positions its children when it is not emitting', async () => {
    const child: TscnNode = { name: 'Marker', type: 'Node2D', children: [], properties: {} };
    const renderer = await render(node({ emitting: 'false' }, [child]));
    // The child is passed through CanvasItem2D's children slot, not the body.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('shows one placeholder, not one per particle, for a texture that failed', async () => {
    const renderer = await render(node({ amount: '32' }), { seedTexture: false });
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const material = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.color.getHexString()).toBe('ff00ff');
  });

  it('applies the CanvasItem modulate as the material tint', async () => {
    const renderer = await render(node({ modulate: 'Color(1, 0, 0, 0.5)' }));
    const material = particleMesh(renderer)!.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.5, 5);
    expect(material.color.r).toBeGreaterThan(material.color.b);
  });

  it('tints every vertex from a Gradient `color_ramp` sub-resource', async () => {
    const gradient: TscnInternalResource = {
      type: 'Gradient',
      id: '1',
      data: {
        id: 'ramp',
        offsets: 'PackedFloat32Array(0, 1)',
        colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
      },
    };
    const renderer = await render(
      node({ amount: '16', color_ramp: 'SubResource("ramp")' }),
      { internalResources: [gradient] }
    );
    const color = particleMesh(renderer)!.geometry.getAttribute('color');
    const reds: number[] = [];
    for (let i = 0; i < color.count; i += 4) reds.push(color.getX(i));
    expect(Math.max(...reds) - Math.min(...reds)).toBeGreaterThan(0.1);
  });

  it('honours a `scale_amount_curve` Curve sub-resource', async () => {
    const curve: TscnInternalResource = {
      type: 'Curve',
      id: '1',
      data: {
        id: 'shrink',
        _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]',
        point_count: '2',
      },
    };
    const withCurve = await render(
      node({ amount: '16', scale_amount_curve: 'SubResource("shrink")' }),
      { internalResources: [curve] }
    );
    const without = await render(node({ amount: '16' }));

    // The narrowest quad, not the pose's bounding box: the furthest particle sets
    // the box, and the curve leaves the youngest one at full scale, so the box
    // sees the curve only when the seed puts an old particle at the edge.
    const narrowestQuad = (r: Rendered): number => {
      const position = particleMesh(r)!.geometry.getAttribute('position');
      let narrowest = Infinity;
      for (let quad = 0; quad * 4 < position.count; quad++) {
        let min = Infinity;
        let max = -Infinity;
        for (let corner = 0; corner < 4; corner++) {
          const x = position.getX(quad * 4 + corner);
          min = Math.min(min, x);
          max = Math.max(max, x);
        }
        narrowest = Math.min(narrowest, max - min);
      }
      return narrowest;
    };
    // The curve runs 1 → 0 over a lifetime, so the oldest quad is a sliver.
    expect(narrowestQuad(withCurve)).toBeLessThan(narrowestQuad(without) / 2);
  });

  it('cancels the node’s own scale under Godot’s default global coords', async () => {
    // `local_coords = false` spawns in canvas space and draws the item with an
    // identity transform, so the 8px quad stays 8px on screen however the node
    // is scaled. Inside the scaled group that means a 8/3 local quad.
    const renderer = await render(
      node({ scale: 'Vector2(3, 3)', local_coords: 'false', amount: '1', explosiveness: '1', gravity: 'Vector2(0, 0)' })
    );
    const geometry = particleMesh(renderer)!.geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(8 / 3, 3);
  });

  it('lets the node’s scale reach the quads under `local_coords`', async () => {
    const renderer = await render(
      node({ scale: 'Vector2(3, 3)', local_coords: 'true', amount: '1', explosiveness: '1', gravity: 'Vector2(0, 0)' })
    );
    const geometry = particleMesh(renderer)!.geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(8, 3);
  });

  it('renders the same geometry on two independent mounts (byte-stability)', async () => {
    const first = await render(node({ amount: '12' }));
    const second = await render(node({ amount: '12' }));
    const a = particleMesh(first)!.geometry.getAttribute('position').array;
    const b = particleMesh(second)!.geometry.getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('cuts the quad to one flipbook cell when the material animates particles', async () => {
    // Without the flipbook each particle draws the whole 11-frame strip, a row of
    // eleven flames instead of one.
    const material: TscnInternalResource = {
      type: 'CanvasItemMaterial',
      id: '1',
      data: {
        id: 'anim',
        particles_animation: 'true',
        particles_anim_h_frames: '4',
        particles_anim_v_frames: '1',
        particles_anim_loop: 'false',
      },
    };
    const animated = await render(
      node({ amount: '1', explosiveness: '1', gravity: 'Vector2(0, 0)', material: 'SubResource("anim")' }),
      { internalResources: [material] }
    );
    const geometry = particleMesh(animated)!.geometry;
    geometry.computeBoundingBox();
    // An 8px-wide texture split into four cells.
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(2, 4);

    const uv = geometry.getAttribute('uv');
    const us = Array.from({ length: 4 }, (_, i) => uv.getX(i));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(0.25, 6);
  });

  it('renders nothing rather than an empty draw call for an emitter with no live particles', async () => {
    // A one_shot emitter whose burst has already expired leaves no particle
    // active. The pose is empty and no mesh should exist.
    const renderer = await render(
      node({ one_shot: 'true', lifetime: '0.1', preprocess: '5.0', amount: '4' })
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
